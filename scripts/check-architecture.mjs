import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { glob } from "node:fs/promises";

const root = process.cwd();
const rules = [
  { pattern: "src/app/**/*.tsx", maxLines: 300 },
  { pattern: "src/components/**/*.tsx", maxLines: 200 },
  { pattern: "src/features/**/*.tsx", maxLines: 320 },
  { pattern: "src/api/**/*.ts", maxLines: 200 }
];

const violations = [];

for (const rule of rules) {
  for await (const file of glob(rule.pattern, { cwd: root })) {
    const content = await readFile(file, "utf8");
    const lines = content.split("\n").length;
    if (lines > rule.maxLines) {
      violations.push(`${file}: ${lines} 行，超过上限 ${rule.maxLines}`);
    }
  }
}

for await (const file of glob("{src,server,shared}/**/*.{ts,tsx}", { cwd: root })) {
  const content = await readFile(file, "utf8");
  const path = relative(root, file);

  if (path.startsWith("src/") && /from\s+["'][^"']*server\//.test(content)) {
    violations.push(`${path}: 前端不得导入 server`);
  }
  if (path.startsWith("server/") && /from\s+["'][^"']*src\//.test(content)) {
    violations.push(`${path}: server 不得导入 src`);
  }
  if (
    !path.startsWith("src/features/body-3d/") &&
    /from\s+["'](?:three|@react-three\/)/.test(content)
  ) {
    violations.push(`${path}: Three/R3F 只能存在于 features/body-3d`);
  }
}

if (violations.length > 0) {
  console.error(["架构检查失败：", ...violations.map((item) => `- ${item}`)].join("\n"));
  process.exitCode = 1;
} else {
  console.log("架构检查通过");
}
