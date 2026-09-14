import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoot =
  process.env.BODYPARTS3D_DIR ??
  resolve(root, ".tmp/3d-muscle-work/source/BodyParts3D/assets/BodyParts3D_data");
const sourceMap = JSON.parse(
  await readFile(resolve(root, "3d-muscles/bodyparts3d-muscle-source-map.json"), "utf8")
);
const taxonomy = await readFile(resolve(root, "3d-muscles/muscles.md"), "utf8");
const indexText = await readFile(resolve(sourceRoot, "parts_list_e.txt"), "utf8");
const taxonomyIds = taxonomy
  .split("\n")
  .filter((line) => line.startsWith("|") && !line.includes("---"))
  .slice(1)
  .map((line) => line.split("|")[3].trim());

const errors = [];
const mappedIds = Object.keys(sourceMap.muscles);

for (const id of taxonomyIds) {
  if (!sourceMap.muscles[id]) errors.push(`${id}: missing source mapping`);
}
for (const id of mappedIds) {
  if (!taxonomyIds.includes(id)) errors.push(`${id}: not present in taxonomy`);
}

for (const [muscleId, config] of Object.entries(sourceMap.muscles)) {
  if (!["exact", "partial"].includes(config.planned_coverage)) {
    errors.push(`${muscleId}: invalid planned coverage`);
  }
  for (const target of config.source_targets) {
    if (!indexText.includes(`${target}\t`)) {
      errors.push(`${muscleId}: ${target} not present in parts_list_e.txt`);
    }
    try {
      await access(resolve(sourceRoot, "stl", `${target}.stl`));
    } catch {
      errors.push(`${muscleId}: ${target}.stl not found`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Source map valid: ${mappedIds.length} muscles, ${sourceRoot}`);
}
