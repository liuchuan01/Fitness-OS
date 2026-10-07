import process from "node:process";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const commands = new Set([
  "parse",
  "quota",
  "get_doc_info",
  "get_outline",
  "search_text",
  "read_pages",
  "read_content"
]);
const taskCommands = new Set(["run", "status", "read", "export", "debug", "resume", "continue"]);
const valueFlags = new Set([
  "--api",
  "--view",
  "--page-range",
  "--password",
  "--files",
  "--operation-id",
  "--run-id",
  "--resource-id",
  "--parent-id",
  "--depth",
  "--scope",
  "--max-results",
  "--limit",
  "--offset"
]);
const booleanFlags = new Set([
  "--approve-paid",
  "--after-funding",
  "--regex",
  "--include-char-details"
]);

export function validateXparseArgs(args, allowPaid) {
  if (
    !Array.isArray(args) ||
    args.length < 1 ||
    args.length > 80 ||
    args.some((arg) => typeof arg !== "string" || arg.length > 4096 || arg.includes("\0"))
  )
    throw new Error("无效的解析参数");
  const task = args[0] === "task";
  if (task && ["resume", "continue"].includes(args[1]) && !allowPaid)
    throw new Error("恢复云端任务前需在后台允许付费解析，避免继续已授权付费的任务。");
  if (task ? !taskCommands.has(args[1]) : !commands.has(args[0]))
    throw new Error("此入口仅支持文档解析、查询与解析任务，不支持安装、登录或配置命令。");
  for (let i = task ? 2 : 1; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("-")) continue;
    if (booleanFlags.has(arg)) {
      if (arg === "--approve-paid" && !allowPaid) throw new Error("后台未允许付费解析。");
      continue;
    }
    if (!valueFlags.has(arg) || !args[i + 1] || args[i + 1].startsWith("-"))
      throw new Error(`不支持的解析参数：${arg}`);
    const value = args[++i];
    if (
      arg === "--api" &&
      (!["auto", "free", "paid"].includes(value) || (value === "paid" && !allowPaid))
    )
      throw new Error("后台未允许该解析计费方式。");
  }
  return [...args];
}

// No shell, no global install, and no authentication values in argv or model-visible results.
export async function runXparse({
  args,
  credentials,
  workspace,
  settings,
  signal,
  userIntent,
  toolCallReason,
  execute = execFile
}) {
  const argv = validateXparseArgs(args, settings.allowPaid);
  const hasContext = userIntent !== undefined || toolCallReason !== undefined;
  if (
    hasContext &&
    [userIntent, toolCallReason].some(
      (value) => typeof value !== "string" || !value.trim() || value.length > 12_000
    )
  )
    throw new Error("首次调用需同时提供原始请求和简短用途，后续调用省略这两个字段。");
  const root = join(workspace, "runtime", "xparse");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const runDirectory = await mkdtemp(join(root, "run-"));
  const contextFile = join(runDirectory, "task-context.json");
  if (hasContext)
    await writeFile(
      contextFile,
      JSON.stringify({
        schema_version: "xparse_task_context.v1",
        user_intent: userIntent,
        tool_call_reason: toolCallReason
      }),
      { mode: 0o600, flag: "wx" }
    );
  if (argv[0] === "parse" || (argv[0] === "task" && argv[1] === "export"))
    argv.push("--output", runDirectory);
  if (argv[0] === "quota") argv.push("--output", "json");
  if (argv[0] === "parse" || (argv[0] === "task" && argv[1] === "run"))
    argv.push("--auth-method", "app-key");
  argv.push("--base-url", "https://api.textin.com");
  if (hasContext) argv.push("--task-context", contextFile);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith("XPARSE_") &&
        !key.startsWith("FITNESS_DSH_") &&
        !key.startsWith("FITNESS_XPARSE_") &&
        key !== "DEEPSEEK_API_KEY"
    )
  );
  Object.assign(env, {
    XPARSE_APP_ID: credentials.appId,
    XPARSE_SECRET_CODE: credentials.secretCode,
    XPARSE_AUTH_METHOD: "app-key",
    XPARSE_STATE_DIR: join(root, "state")
  });
  const redact = (text) =>
    [credentials.appId, credentials.secretCode].reduce(
      (value, secret) => value.replaceAll(secret, "[redacted]"),
      String(text)
    );
  try {
    return await new Promise((resolve, reject) => {
      const child = execute(
        require("xparse-cli/lib/platform.js").resolveBinaryPath(),
        argv,
        {
          cwd: workspace,
          env,
          signal,
          timeout: 180_000,
          killSignal: "SIGKILL",
          maxBuffer: 2 * 1024 * 1024,
          encoding: "utf8"
        },
        (error, stdout, stderr) => {
          if (signal?.aborted) {
            reject(new Error("解析已取消；已提交的云端任务可能仍在运行，请保留已有任务 ID。"));
            return;
          }
          resolve({
            exitCode: error ? (typeof error.code === "number" ? error.code : 1) : 0,
            stdout: redact(stdout),
            stderr: redact(
              stderr ||
                (error ? "本地解析进程未正常完成；请保留已返回的任务标识，勿重复提交。" : "")
            ),
            outputDirectory: runDirectory
          });
        }
      );
      child.stdin?.end();
    });
  } finally {
    await rm(contextFile, { force: true });
  }
}
