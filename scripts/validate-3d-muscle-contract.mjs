import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const contract = JSON.parse(
  await readFile(resolve(root, "3d-muscles/body-model-contract.json"), "utf8")
);
const manifest = JSON.parse(
  await readFile(resolve(root, "3d-muscles/bodyparts3d-fitness-taxonomy-manifest.json"), "utf8")
);

const errors = [];
const muscleEntries = Object.entries(contract.muscles ?? {});
const targetSet = new Set(Object.values(manifest.targets ?? {}).flat());
const validCoverage = new Set(["exact", "partial", "missing"]);

if (contract.schema_version !== 3) errors.push("schema_version must be 3");
if ("legacy_aggregates" in contract)
  errors.push("legacy_aggregates compatibility layer is forbidden");
if (muscleEntries.length !== 67) errors.push(`expected 67 muscles, found ${muscleEntries.length}`);
if (new Set(muscleEntries.map(([id]) => id)).size !== muscleEntries.length) {
  errors.push("muscle ids must be unique");
}

for (const [id, muscle] of muscleEntries) {
  if (!contract.groups?.[muscle.group]?.muscle_ids.includes(id)) {
    errors.push(`${id}: missing from group ${muscle.group}`);
  }
  if (!validCoverage.has(muscle.coverage)) errors.push(`${id}: invalid coverage`);

  if (muscle.coverage === "missing") {
    if (muscle.model_groups.length || muscle.model_targets.length) {
      errors.push(`${id}: missing must not have model mappings`);
    }
    if (muscle.pickable || muscle.highlightable) {
      errors.push(`${id}: missing must not be interactive`);
    }
  }

  if (["partial", "missing"].includes(muscle.coverage) && muscle.pickable) {
    errors.push(`${id}: only exact coverage may be directly pickable`);
  }

  if (muscle.coverage === "exact" && muscle.model_targets.length === 0) {
    errors.push(`${id}: exact requires targets`);
  }

  for (const target of muscle.model_targets) {
    if (!targetSet.has(target)) errors.push(`${id}: unknown target ${target}`);
  }
}

const targetOwners = new Map();
for (const [id, muscle] of muscleEntries) {
  for (const target of muscle.model_targets) {
    const owners = targetOwners.get(target) ?? [];
    owners.push(id);
    targetOwners.set(target, owners);
  }
}
for (const [target, owners] of targetOwners) {
  if (owners.length > 1)
    errors.push(`${target}: mapped to multiple muscle ids: ${owners.join(", ")}`);
}
for (const target of targetSet) {
  if (!targetOwners.has(target)) errors.push(`${target}: manifest target missing from contract`);
}

const lowerBackMuscle = contract.muscles?.erector_spinae_lower;
if (
  lowerBackMuscle?.model_targets?.some((target) => /latissimus|trapezius|lats|traps/i.test(target))
) {
  errors.push("lower_back must not borrow latissimus or trapezius targets");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Contract valid: ${muscleEntries.length} muscles, ${Object.keys(contract.groups).length} groups`
  );
}
