import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const taxonomyPath = resolve(root, "3d-muscles/muscles.md");
const manifestPath = resolve(
  root,
  process.env.MODEL_MANIFEST ?? "3d-muscles/bodyparts3d-fitness-taxonomy-manifest.json"
);
const outputPath = resolve(root, "3d-muscles/body-model-contract.json");
const sourceMapPath = resolve(root, "3d-muscles/bodyparts3d-muscle-source-map.json");

const groupLabels = {
  chest: "胸部",
  shoulders: "肩部",
  scapular: "肩胛带",
  back: "背部",
  upper_arm_anterior: "上臂前侧",
  upper_arm_posterior: "上臂后侧",
  forearm: "前臂",
  core: "核心",
  glutes: "臀部",
  hip: "髋部",
  quadriceps: "股四头肌",
  adductors: "内收肌群",
  hamstrings: "腘绳肌",
  lower_leg_posterior: "小腿后侧浅层",
  lower_leg_anterior: "小腿前侧",
  lower_leg_lateral: "小腿外侧",
  lower_leg_deep: "小腿后侧深层",
  neck: "颈部"
};

function parseTaxonomy(markdown) {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.includes("---"))
    .slice(1)
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length !== 7) throw new Error(`Invalid taxonomy row: ${line}`);
      const [group, groupLabel, id, labelZh, targetCount, priority, note] = cells;
      return {
        group,
        groupLabel,
        id,
        labelZh,
        targetCount: Number(targetCount),
        priority,
        note
      };
    });
}

function coverageFor(id, manifest, sourceMap) {
  if (manifest.targets[id]) {
    return {
      coverage: manifest.coverage?.[id] ?? sourceMap.muscles[id]?.planned_coverage ?? "exact",
      modelTargets: manifest.targets[id]
    };
  }
  return { coverage: "missing", modelTargets: [] };
}

function validate(contract, manifest) {
  const ids = Object.keys(contract.muscles);
  if (ids.length !== 67) throw new Error(`Expected 67 muscle ids, found ${ids.length}`);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate muscle ids");

  const validCoverage = new Set(["exact", "partial", "missing"]);
  for (const [id, muscle] of Object.entries(contract.muscles)) {
    if (!validCoverage.has(muscle.coverage)) throw new Error(`${id}: invalid coverage`);
    if (muscle.coverage === "missing") {
      if (muscle.model_groups.length || muscle.model_targets.length) {
        throw new Error(`${id}: missing muscle cannot have model targets`);
      }
      if (muscle.pickable || muscle.highlightable) {
        throw new Error(`${id}: missing muscle cannot be interactive`);
      }
    }
    if (muscle.coverage === "exact" && muscle.model_targets.length === 0) {
      throw new Error(`${id}: exact muscle requires model targets`);
    }
    for (const target of muscle.model_targets) {
      const present = Object.values(manifest.targets).some((targets) => targets.includes(target));
      if (!present) throw new Error(`${id}: target not present in manifest: ${target}`);
    }
  }
}

const [taxonomyMarkdown, manifestJson, sourceMapJson] = await Promise.all([
  readFile(taxonomyPath, "utf8"),
  readFile(manifestPath, "utf8"),
  readFile(sourceMapPath, "utf8")
]);
const taxonomy = parseTaxonomy(taxonomyMarkdown);
const manifest = JSON.parse(manifestJson);
const sourceMap = JSON.parse(sourceMapJson);

const groups = {};
const muscles = {};

for (const row of taxonomy) {
  if (!groups[row.group]) {
    groups[row.group] = {
      label_zh: groupLabels[row.group] ?? row.groupLabel,
      muscle_ids: []
    };
  }
  groups[row.group].muscle_ids.push(row.id);

  const { coverage, modelTargets } = coverageFor(row.id, manifest, sourceMap);
  const modelGroups = coverage === "missing" ? [] : [row.group];
  const sourceNote = sourceMap.muscles[row.id]?.note;
  const derivation = sourceMap.muscles[row.id]?.derivation;
  const provenanceNote = [
    row.note,
    sourceNote,
    derivation
      ? `Derived from real source geometry using ${derivation.type} (${derivation.region}).`
      : null
  ]
    .filter(Boolean)
    .join(" ");
  muscles[row.id] = {
    group: row.group,
    label_zh: row.labelZh,
    priority: row.priority,
    expected_target_count: row.targetCount,
    display_mode:
      manifest.display_modes?.[row.id] ?? sourceMap.muscles[row.id]?.display_mode ?? "normal",
    coverage,
    model_groups: modelGroups,
    model_targets: modelTargets,
    highlightable: coverage !== "missing",
    pickable: coverage === "exact",
    note:
      coverage === "missing"
        ? `${provenanceNote} No validated mesh is present; show list/numeric data only.`
        : provenanceNote
  };
}

const coverageCounts = Object.values(muscles).reduce(
  (counts, muscle) => {
    counts[muscle.coverage] += 1;
    return counts;
  },
  { exact: 0, partial: 0, missing: 0 }
);

const contract = {
  schema_version: 3,
  status: "taxonomy_contract",
  generated_from: {
    taxonomy: "muscles.md",
    model_manifest: manifestPath.replace(`${root}/3d-muscles/`, "")
  },
  model_asset: manifest.assets.combined_draco ?? manifest.assets.combined,
  coverage_states: {
    exact:
      "Dedicated mesh targets represent this muscle id; exact click and highlight are allowed.",
    partial:
      "Only part of the expected geometry is present; available targets must be labeled partial.",
    missing: "No validated target exists; no highlight, hover, or click is allowed."
  },
  interaction_policy: {
    exact: { highlight: true, hover: true, click: "muscle" },
    partial: { highlight: true, hover: true, click: "region_with_partial_badge" },
    missing: { highlight: false, hover: false, click: "none" }
  },
  rendering: {
    skin_node_prefix: "skin",
    muscle_node_prefix: "muscle",
    normalize_node_id: "remove non-alphanumeric characters and lowercase"
  },
  summary: {
    muscle_count: Object.keys(muscles).length,
    group_count: Object.keys(groups).length,
    coverage: coverageCounts
  },
  groups,
  muscles
};

validate(contract, manifest);
await writeFile(outputPath, `${JSON.stringify(contract, null, 2)}\n`);
console.log(
  `Wrote ${outputPath}: ${contract.summary.muscle_count} muscles, ` +
    `${coverageCounts.exact} exact, ${coverageCounts.partial} partial, ` +
    `${coverageCounts.missing} missing`
);
