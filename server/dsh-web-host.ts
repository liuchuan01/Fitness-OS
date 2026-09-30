import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { applicationRoot } from "./workspace.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type DshWebHostStatus =
  | { status: "starting" }
  | { status: "ready"; url: string }
  | { status: "failed"; error: string };

export class DshWebHost {
  private child: ChildProcessWithoutNullStreams | undefined;
  private closingChild: ChildProcessWithoutNullStreams | undefined;
  private restartRequested = false;
  private current: DshWebHostStatus = { status: "starting" };

  constructor(
    private readonly options: {
      workspaceRoot: string;
      port: number;
      dshHome?: string;
      bridgeSecret: string;
      agentSettingsFile: string;
      profileSource: string;
    }
  ) {}

  start() {
    if (this.closingChild) {
      this.restartRequested = true;
      return;
    }
    if (this.child || this.current.status === "ready") return;
    this.current = { status: "starting" };
    const packageRoot = dirname(require.resolve("@deepseek-ai/dsh/package.json"));
    const dshHome = this.options.dshHome ?? join(this.options.workspaceRoot, "runtime", "dsh");
    const bindHost = dshBindHost(process.env.DSH_WEB_BIND_HOST);
    const fitness = this.readFitnessConfig();
    this.prepareFitnessProfile(dshHome, bindHost);
    console.info(`[Fitness DSH] Starting Host on ${bindHost}:${this.options.port}`);
    const child = spawn(
      process.execPath,
      [
        join(packageRoot, "lib/bin.js"),
        "--profile",
        "fitness",
        "--no-open",
        "--port",
        String(this.options.port)
      ],
      {
        cwd: this.options.workspaceRoot,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) => key !== "DSH_PROVIDER" && key !== "DSH_MODEL"
            )
          ),
          DSH_HOME: dshHome,
          FITNESS_DSH_BRIDGE_SECRET: this.options.bridgeSecret,
          FITNESS_DSH_AGENT_SETTINGS_FILE: resolve(this.options.agentSettingsFile),
          WORKSPACE_ROOT: this.options.workspaceRoot,
          FITNESS_DSH_WORKSPACE_PATH: this.options.workspaceRoot,
          FITNESS_DSH_PROFILE_FILE: join(this.options.workspaceRoot, "fitness", "profile.yaml"),
          FITNESS_DSH_APP_ROOT: applicationRoot,
          FITNESS_DSH_RESOURCES_ROOT: join(applicationRoot, "resources", "fitness"),
          FITNESS_DSH_WORKSPACE_TITLE: fitness.workspaceTitle,
          FITNESS_DSH_INTERACTIVE_SESSION_ID: fitness.interactiveSessionId
        },
        stdio: ["pipe", "pipe", "pipe"]
      }
    );
    child.stdin.end();
    this.child = child;
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const url = /dsh web: (http:\/\/[^\s]+)/u.exec(chunk)?.[1];
      if (url && this.child === child) {
        this.current = { status: "ready", url };
        console.info(`[Fitness DSH] Host ready on ${bindHost}:${this.options.port}`);
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-4_000);
    });
    child.once("exit", (code, signal) => {
      this.handleChildTermination(
        child,
        summarizeDshFailure(stderr, `Host exited (${signal ?? String(code)})`, [
          this.options.bridgeSecret,
          process.env.DEEPSEEK_API_KEY
        ])
      );
    });
    child.once("error", (error) => {
      if (this.closingChild === child) {
        this.current = { status: "failed", error: error.message };
        console.error(`[Fitness DSH] Host process error: ${error.message}`);
        return;
      }
      this.handleChildTermination(child, error.message);
    });
  }

  status(): DshWebHostStatus {
    return this.current;
  }

  close() {
    this.restartRequested = false;
    const child = this.child;
    this.child = undefined;
    this.current = { status: "starting" };
    if (!child) return;
    this.closingChild = child;
    child.kill("SIGTERM");
  }

  private handleChildTermination(child: ChildProcessWithoutNullStreams, error: string) {
    if (this.closingChild === child) {
      this.closingChild = undefined;
      if (this.restartRequested) {
        this.restartRequested = false;
        try {
          this.start();
        } catch (cause) {
          this.current = {
            status: "failed",
            error: cause instanceof Error ? cause.message : String(cause)
          };
        }
      }
      return;
    }
    if (this.child !== child) return;
    this.child = undefined;
    this.current = { status: "failed", error };
    console.error(`[Fitness DSH] ${error}`);
  }

  private readFitnessConfig() {
    const file = join(this.options.profileSource, "config.json");
    const value = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const workspacePath = requiredString(value.workspacePath, "workspacePath", file);
    const workspaceTitle = requiredString(value.workspaceTitle, "workspaceTitle", file);
    const interactiveSessionId = requiredString(
      value.interactiveSessionId,
      "interactiveSessionId",
      file
    );
    return { workspacePath, workspaceTitle, interactiveSessionId };
  }

  private prepareFitnessProfile(dshHome: string, bindHost: "127.0.0.1" | "0.0.0.0") {
    const profileRoot = join(dshHome, "profiles", "fitness");
    const moduleRoot = join(profileRoot, "node_modules", "@ai-fitness-os");
    mkdirSync(moduleRoot, { recursive: true });
    const profile = {
      name: "dsh-profile-fitness",
      private: true,
      type: "module",
      dependencies: {},
      dsh: {
        profile: {
          bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"],
          patchReload: "startup"
        }
      }
    };
    writeFileSync(join(profileRoot, "package.json"), `${JSON.stringify(profile, null, 2)}\n`);
    const patchSource = join(this.options.profileSource, "profile", "cordis.patch.yml");
    const patch = readFileSync(patchSource, "utf8").replace("__FITNESS_DSH_BIND_HOST__", bindHost);
    const credentialsPatch = `\n- id: credentials\n  config:\n    path: ${JSON.stringify(join(this.options.workspaceRoot, "config", "dsh-credentials.yaml"))}\n`;
    writeFileSync(join(profileRoot, "cordis.patch.yml"), patch + credentialsPatch);
    for (const name of ["dsh-fitness-automation-bridge", "dsh-fitness-surface"]) {
      const target = join(moduleRoot, name);
      if (!existsSync(target)) {
        symlinkSync(
          join(this.options.profileSource, name.replace("dsh-fitness-", "")),
          target,
          "dir"
        );
      }
    }
  }
}

function summarizeDshFailure(stderr: string, fallback: string, secrets: (string | undefined)[]) {
  const lines = stderr.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const message = [...lines].reverse().find((line) => /^(?:Error:|\w+Error:|dsh: fatal)/u.test(line)) ??
    lines.at(-1) ?? fallback;
  let safe = message;
  for (const secret of secrets) {
    if (secret) safe = safe.replaceAll(secret, "[redacted]");
  }
  return safe
    .replace(/([?&]token=)[^\s&]+/giu, "$1[redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gu, "[redacted]");
}

function dshBindHost(value: string | undefined): "127.0.0.1" | "0.0.0.0" {
  const host = value ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "0.0.0.0") {
    throw new Error(`DSH_WEB_BIND_HOST must be 127.0.0.1 or 0.0.0.0, got ${host}`);
  }
  return host;
}

function requiredString(value: unknown, key: string, file: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${file}: ${key} must be a non-empty string`);
  }
  return value;
}
