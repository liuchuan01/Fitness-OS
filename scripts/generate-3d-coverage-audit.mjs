import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const contract = JSON.parse(
  await readFile(resolve(root, "3d-muscles/body-model-contract.json"), "utf8")
);
const sourceMap = JSON.parse(
  await readFile(resolve(root, "3d-muscles/bodyparts3d-muscle-source-map.json"), "utf8")
);
const manifest = JSON.parse(
  await readFile(resolve(root, "3d-muscles/bodyparts3d-fitness-taxonomy-manifest.json"), "utf8")
);

const lines = [
  "# Muscle Coverage Audit",
  "",
  "Generated from `body-model-contract.json`, `bodyparts3d-muscle-source-map.json`, and the runtime manifest.",
  "",
  "## Summary",
  "",
  `- Taxonomy muscles: ${contract.summary.muscle_count}`,
  `- First-level groups: ${contract.summary.group_count}`,
  `- Exact: ${contract.summary.coverage.exact}`,
  `- Partial: ${contract.summary.coverage.partial}`,
  `- Missing: ${contract.summary.coverage.missing}`,
  `- Runtime muscle targets: ${Object.values(manifest.targets).flat().length}`,
  `- Draco GLB: ${(manifest.stats.glb_bytes / 1024 / 1024).toFixed(2)} MB`,
  `- Skin triangles: ${manifest.stats.skin_polygons}`,
  `- Muscle triangles: ${manifest.stats.muscle_polygons}`,
  `- Armatures: ${manifest.stats.armatures}`,
  "",
  "## Group Coverage",
  "",
  "|group|muscles|exact|partial|missing|",
  "|---|---:|---:|---:|---:|"
];

for (const [groupId, group] of Object.entries(contract.groups)) {
  const counts = { exact: 0, partial: 0, missing: 0 };
  for (const muscleId of group.muscle_ids) counts[contract.muscles[muscleId].coverage] += 1;
  lines.push(
    `|${groupId}|${group.muscle_ids.length}|${counts.exact}|${counts.partial}|${counts.missing}|`
  );
}

lines.push(
  "",
  "## Detailed Mapping",
  "",
  "|group|muscle id|label|priority|coverage|runtime targets|source geometry|",
  "|---|---|---|---|---|---:|---|"
);

for (const [muscleId, muscle] of Object.entries(contract.muscles)) {
  const sources = sourceMap.muscles[muscleId]?.source_targets?.join(", ") ?? "-";
  lines.push(
    `|${muscle.group}|${muscleId}|${muscle.label_zh.replaceAll("|", "/")}|${muscle.priority}|${muscle.coverage}|${muscle.model_targets.length}|${sources}|`
  );
}

lines.push(
  "",
  "## Partial Semantics",
  "",
  "Partial entries use real BodyParts3D geometry but do not claim exact one-structure semantics:",
  "",
  ...Object.entries(contract.muscles)
    .filter(([, muscle]) => muscle.coverage === "partial")
    .map(([muscleId, muscle]) => `- \`${muscleId}\`: ${muscle.note}`),
  "",
  "A partial target may be highlighted with a visible partial badge. It must not be returned as an exact per-muscle click result.",
  "",
  "## Provenance Rule",
  "",
  "Every runtime target is derived from the BodyParts3D v3 source files listed above. No procedural primitive or hand-drawn replacement geometry is accepted."
);

await writeFile(resolve(root, "3d-muscles/MUSCLE-COVERAGE-AUDIT.md"), `${lines.join("\n")}\n`);
console.log("Wrote 3d-muscles/MUSCLE-COVERAGE-AUDIT.md");
