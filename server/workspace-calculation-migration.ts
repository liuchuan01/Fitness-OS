import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { parse, stringify } from "yaml";
import {
  calculateStimulus,
  muscleMapSchema,
  stimulusRulesSchema,
  workoutSchema
} from "../shared/fitness/index.js";
import type { WorkspacePaths } from "./workspace.js";
async function yamlFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return (
    await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith("."))
        .map((entry) =>
          entry.isDirectory()
            ? yamlFiles(join(root, entry.name))
            : entry.isFile() && /\.ya?ml$/.test(entry.name)
              ? [join(root, entry.name)]
              : []
        )
    )
  ).flat();
}
function factsHash(value: Record<string, unknown>) {
  const facts = { ...value };
  delete facts.computed;
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex");
}
/** Applied only to an isolated migration destination with the originals already backed up. */
export async function migrateCalculationSemantics(paths: WorkspacePaths) {
  const map = muscleMapSchema.parse(
    parse(await readFile(join(paths.resourcesRoot, "muscles/muscle_map.yaml"), "utf8"))
  );
  const rules = stimulusRulesSchema.parse(
    parse(await readFile(join(paths.resourcesRoot, "muscles/stimulus_rules.yaml"), "utf8"))
  );
  const changes: { file: string; old: unknown; next: unknown; facts_sha256: string }[] = [];
  for (const file of await yamlFiles(join(paths.fitnessRoot, "workouts"))) {
    const raw = parse(await readFile(file, "utf8")) as Record<string, unknown>;
    const old = raw.computed;
    const expected = calculateStimulus(workoutSchema.parse(raw), map, rules);
    if (JSON.stringify(old) === JSON.stringify(expected)) continue;
    const before = factsHash(raw);
    raw.computed = expected;
    if (factsHash(raw) !== before) throw new Error(`Migration changed workout facts: ${file}`);
    await writeFile(file, stringify(raw));
    changes.push({
      file: file.slice(paths.fitnessRoot.length + 1),
      old,
      next: expected,
      facts_sha256: before
    });
  }
  const manifestFile = join(paths.fitnessRoot, "manifest.yaml");
  const manifest = parse(await readFile(manifestFile, "utf8")) as Record<string, unknown>;
  manifest.calculation_rules_version = "2";
  await writeFile(manifestFile, stringify(manifest));
  const report = {
    schema_version: 1,
    calculation_rules_version: "2",
    reason:
      "Missing actual bodyweight/load is unknown: total_volume_kg null and missing_load_sets. Stimulus/recovery numerical formulas unchanged.",
    changes
  };
  await writeFile(
    join(paths.workspaceRoot, "calculation-migration-report.json"),
    JSON.stringify(report, null, 2)
  );
  return report;
}
