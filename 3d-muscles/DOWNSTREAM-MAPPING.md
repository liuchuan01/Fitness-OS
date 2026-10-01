# Downstream 3D Muscle Mapping Contract

## Required Files

```txt
bodyparts3d-fitness-taxonomy-draco.glb
bodyparts3d-fitness-taxonomy-manifest.json
body-model-contract.json
```

The GLB is static and Draco-compressed. It has no armature, animation, or
skinning dependency.

## Identity Layers

```txt
exercise mapping muscle_id
  -> deterministic stimulus[muscle_id]
  -> contract.muscles[muscle_id]
  -> contract.muscles[muscle_id].model_targets
  -> GLB node
```

The 67 `contract.muscles` IDs are the authoritative product-level 3D taxonomy.
Exercise mappings, computed fields, API payloads, heatmap state, and click
details must use those IDs directly. Legacy aggregate IDs are rejected.

## Loading

```ts
const [gltf, manifest, contract] = await Promise.all([
  loadGltf("/models/bodyparts3d/bodyparts3d-fitness-taxonomy-draco.glb"),
  fetch("/models/bodyparts3d/bodyparts3d-fitness-taxonomy-manifest.json").then((r) => r.json()),
  fetch("/models/bodyparts3d/body-model-contract.json").then((r) => r.json())
]);
```

Normalize exporter node names before matching:

```ts
function normalizeModelId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
```

Build a lookup from every `contract.muscles[id].model_targets` entry to the
corresponding muscle contract. Do not infer anatomy from node-name substrings.

## Direct Stimulus Mapping

Apply each computed score directly to its canonical muscle:

```ts
for (const [muscleId, score] of Object.entries(computed.stimulus)) {
  const muscle = contract.muscles[muscleId];
  if (muscle?.highlightable) {
    highlight(muscle.model_targets, score, muscle.coverage);
  }
}
```

Do not expand a broad score across child muscles or infer a parent mapping.

## Interaction Semantics

| coverage  | highlight           | hover/click result                                  |
| --------- | ------------------- | --------------------------------------------------- |
| `exact`   | yes                 | specific `muscle_id`                                |
| `partial` | yes, visibly marked | region/partial explanation, not an exact muscle hit |
| `missing` | no                  | no 3D hit; list/numeric UI only                     |

The current asset has 60 `exact`, 7 `partial`, and no missing entries.

`erector_spinae_lower` uses real partial geometry. It never borrows latissimus
or trapezius nodes, and it is not returned as an exact muscle click.

## Normal And Professional Modes

The manifest `display_modes` field marks deep or rehabilitation-oriented
muscles as `professional`. A normal view may hide those meshes, while a
professional view can reveal them with lower opacity.

This is display filtering only. IDs and target mappings must remain stable.

## Delivery Validation

Before consuming a new model revision:

```sh
npm run validate:3d-source-map
npm run generate:3d-contract
npm run validate:3d-contract
npm run generate:3d-audit
npm run typecheck
npm run test
npm run build
```

Verify the main application on desktop and mobile (the standalone viewer was removed on 2026-09-30), including:

```txt
model loads without console errors
skin and muscle layers align
exact clicks return child muscle IDs
partial targets are not exact-pickable
missing targets do not highlight or hit-test
node names still match the contract after compression
```

## License

BodyParts3D geometry is CC BY-SA 2.1 Japan. Preserve attribution and complete a
share-alike review before production distribution.
