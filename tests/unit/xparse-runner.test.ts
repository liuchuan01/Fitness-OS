import { mkdtemp, readFile, rm, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";

it("fails closed for missing, malformed, and invalid feature configuration", async () => {
  const path = "../../dsh-fitness/automation-bridge/xparse.js";
  const { readXparseSettings } = await import(path);
  const root = await mkdtemp(join(tmpdir(), "fitness-xparse-config-"));
  const file = join(root, "settings.yaml");
  try {
    expect(readXparseSettings(file).enabled).toBe(false);
    for (const content of ["xparse: [", "xparse: {enabled: true, allowPaid: wrong}"]) {
      await writeFile(file, content);
      expect(readXparseSettings(file)).toEqual({ enabled: false, allowPaid: false });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("rejects auth/endpoint/output overrides and unapproved paid operations", async () => {
  const path = "../../dsh-fitness/automation-bridge/xparse-runner.js";
  const { validateXparseArgs } = await import(path);
  for (const args of [
    ["auth"],
    ["parse", "file.pdf", "--api=paid"],
    ["parse", "file.pdf", "--api", "paid"],
    ["quota", "--base-url", "https://example.com"],
    ["parse", "file.pdf", "--output", "fitness"],
    ["task", "resume", "id", "--approve-paid"],
    ["task", "continue", "id"],
    ["parse", "file.pdf", "--verbose"]
  ])
    expect(() => validateXparseArgs(args, false)).toThrow();
  expect(validateXparseArgs(["parse", "file.pdf", "--api", "paid"], true)).toEqual([
    "parse",
    "file.pdf",
    "--api",
    "paid"
  ]);
});

it("uses separate argv and private state, preserves errors, and redacts child output", async () => {
  const path = "../../dsh-fitness/automation-bridge/xparse-runner.js";
  const { runXparse } = await import(path);
  const workspace = await mkdtemp(join(tmpdir(), "fitness-xparse-runner-"));
  try {
    const result = await runXparse({
      args: ["parse", "a file; touch injected.pdf"],
      credentials: { appId: "test-app-id", secretCode: "secret-value" },
      workspace,
      settings: { allowPaid: false },
      signal: new AbortController().signal,
      userIntent: "导入",
      toolCallReason: "读取",
      execute: (
        _file: string,
        argv: string[],
        options: { env: Record<string, string> },
        callback: (error: { code: number }, stdout: string, stderr: string) => void
      ) => {
        expect(argv).toContain("a file; touch injected.pdf");
        expect(argv.join(" ")).not.toContain("secret-value");
        expect(options.env.XPARSE_SECRET_CODE).toBe("secret-value");
        expect(options.env.XPARSE_STATE_DIR).toBe(join(workspace, "runtime/xparse/state"));
        callback(
          { code: 3 },
          "",
          '{"schema_version":"xparse_error.v1","error_code":"FAILED","message":"secret-value"}'
        );
        return { stdin: { end() {} } };
      }
    });
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("xparse_error.v1");
    expect(result.stderr).not.toContain("secret-value");
    expect(await readdir(result.outputDirectory)).not.toContain("task-context.json");
    await expect(readFile(join(workspace, "injected.pdf"))).rejects.toThrow();
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
