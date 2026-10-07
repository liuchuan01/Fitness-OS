/* global AbortController, AbortSignal */
import process from "node:process";
import { readFileSync, watchFile, unwatchFile } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { parse } from "yaml";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { runXparse } from "./xparse-runner.js";

const credentialRef = "FITNESS_XPARSE_APP_CREDENTIALS";
const skillFile = join(
  dirname(createRequire(import.meta.url).resolve("./package.json")),
  "xparse-skill",
  "SKILL.md"
);
const skillBase = dirname(skillFile);
const skill = {
  name: "xparse-parse",
  description:
    "解析用户指定的 PDF、图片和 Office 健身记录，整理其他软件导出的历史训练记录并通过 Fitness CLI 校验导入。",
  source: "bundled",
  provider: "fitness-xparse",
  invocation: { modelInvocable: true, userInvocable: true },
  resourceBase: { kind: "directory", path: skillBase },
  rank: 50,
  locator: "xparse-parse"
};

export function readXparseSettings(file) {
  try {
    const value = parse(readFileSync(file, "utf8"))?.xparse;
    if (
      !value ||
      typeof value.enabled !== "boolean" ||
      typeof value.allowPaid !== "boolean" ||
      Object.keys(value).sort().join(",") !== "allowPaid,enabled"
    )
      return { enabled: false, allowPaid: false };
    return { enabled: value?.enabled === true, allowPaid: value?.allowPaid === true };
  } catch {
    return { enabled: false, allowPaid: false };
  }
}

export function registerXparse(ctx, { settingsFile, secret, matchesSecret, readBody }) {
  let enabled = false;
  let disposeTool;
  let invalidate = () => {};
  const executions = new Set();
  const current = () => readXparseSettings(settingsFile);
  const sync = () => {
    const next = current().enabled;
    if (enabled === next) return;
    enabled = next;
    if (enabled) disposeTool = ctx.tools.register(tool);
    else {
      disposeTool?.();
      disposeTool = undefined;
      for (const controller of executions) controller.abort();
    }
    invalidate();
  };
  const tool = defineTool({
    name: "xparse",
    description:
      "通过项目管理的 TextIn CLI 解析文件。先加载 xparse-parse 技能；传递 CLI 参数数组，不传命令名 xparse-cli、不使用 shell。非零 exitCode 表示失败。",
    parameters: {
      args: { type: "array", items: { type: "string" }, required: true },
      userIntent: {
        type: "string",
        description: "仅新请求首次调用时提供用户原始请求，不含隐藏推理或凭据；后续调用省略"
      },
      toolCallReason: {
        type: "string",
        description: "与 userIntent 一起在首次调用时提供：需要获取什么文档信息"
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          exitCode: { type: "number", required: true },
          stdout: { type: "string", required: true },
          stderr: { type: "string", required: true },
          outputDirectory: { type: "string", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
    },
    async execute(args, exec) {
      if (!current().enabled) throw new Error("文件解析已关闭。");
      const stored = await ctx.credentials.resolve(credentialRef);
      if (!stored) throw new Error("请先在设置 → 文件解析中配置 TextIn App ID 和 Secret Code。");
      let credentials;
      try {
        credentials = parseCredentials(JSON.parse(stored.value));
      } catch {
        throw new Error("TextIn 凭据格式无效，请在后台重新配置。");
      }
      if (!current().enabled) throw new Error("文件解析已关闭。");
      const controller = new AbortController();
      executions.add(controller);
      try {
        return await runXparse({
          ...args,
          credentials,
          workspace: process.env.FITNESS_DSH_WORKSPACE_PATH,
          settings: current(),
          signal: AbortSignal.any([exec.signal, controller.signal])
        });
      } finally {
        executions.delete(controller);
      }
    }
  });
  const disposeProvider = ctx.skills.registerProvider((control) => {
    invalidate = control.invalidate;
    return {
      name: skill.provider,
      async list() {
        return current().enabled ? [skill] : [];
      },
      async get() {
        if (!current().enabled) return undefined;
        return {
          ...skill,
          content: readFileSync(skillFile, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "")
        };
      }
    };
  });
  const disposeStep = ctx.on("agent/pre-step", async (_event, next) => {
    sync();
    return next();
  });
  const disposeGuard = ctx.tools.guard((exec) => {
    if (exec.name === "xparse" && !current().enabled) return "文件解析已关闭。";
    if (
      /bash|shell|pwsh|exec/.test(exec.name) &&
      /xparse-cli|xparse-skills|FITNESS_XPARSE_APP_CREDENTIALS/.test(JSON.stringify(exec.arguments))
    )
      return "请通过已启用的文件解析工具执行；CLI 安装和凭据由后台管理。";
  });
  watchFile(settingsFile, { interval: 250, persistent: false }, sync);
  sync();
  const disposeRoute = ctx.webServer.register({
    kind: "exact",
    path: "/fitness-xparse-credentials",
    handler: async (request, response) => {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      const send = (status, payload) => {
        response.writeHead(status);
        response.end(JSON.stringify(payload));
      };
      if (!matchesSecret(request.headers["x-fitness-bridge-secret"], secret)) {
        send(401, { ok: false, error: "unauthorized" });
        return;
      }
      if (!["GET", "PUT"].includes(request.method)) {
        send(405, { ok: false, error: "method not allowed" });
        return;
      }
      try {
        if (request.method === "PUT") {
          const input = JSON.parse(await readBody(request));
          if (input?.clear === true && Object.keys(input).length === 1)
            await ctx.credentialsController.unset(credentialRef);
          else
            await ctx.credentialsController.set(
              credentialRef,
              JSON.stringify(parseCredentials(input))
            );
        }
        const info = (await ctx.credentialsController.describe([credentialRef]))[credentialRef];
        send(200, {
          ok: true,
          credentials: { configured: info.configured, writable: info.writable }
        });
      } catch {
        send(422, {
          ok: false,
          error: "TextIn 凭据操作失败，请检查输入；启动环境提供的凭据需在启动环境中修改。"
        });
      }
    }
  });
  return () => {
    unwatchFile(settingsFile, sync);
    for (const controller of executions) controller.abort();
    disposeTool?.();
    disposeProvider();
    disposeStep();
    disposeGuard();
    disposeRoute();
  };
}

function parseCredentials(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Object.keys(input).sort().join(",") !== "appId,secretCode" ||
    [input.appId, input.secretCode].some(
      (value) =>
        typeof value !== "string" || !value.trim() || value.length > 4096 || /[\r\n\0]/.test(value)
    )
  )
    throw new Error("Invalid TextIn credentials");
  return { appId: input.appId.trim(), secretCode: input.secretCode.trim() };
}
