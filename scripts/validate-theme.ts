import { basename, resolve } from "node:path";
import { validateThemeDirectory } from "../server/themes/catalog.js";

const directory = process.argv[2];
if (!directory) {
  console.error("用法：npm run validate:theme -- <主题包目录>");
  process.exitCode = 1;
} else {
  try {
    const { theme, diagnostics } = await validateThemeDirectory(resolve(directory));
    if (theme.id !== basename(resolve(directory))) throw new Error("主题 ID 必须与目录名称一致");
    console.log(`主题 ${theme.name} (${theme.id}@${theme.version}) 协议校验通过`);
    for (const diagnostic of diagnostics) console.error(diagnostic.message);
    if (diagnostics.length) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "主题包校验失败");
    process.exitCode = 1;
  }
}
