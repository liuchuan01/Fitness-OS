# 3D Muscle Taxonomy Iteration Plan

Date: 2026-06-21

## Purpose

This document defines how the 3D body model should evolve from the current broad-region preview into a fitness-oriented per-muscle interaction model.

Source taxonomy:

```txt
3d-muscles/muscles.md
```

Current coverage audit:

```txt
3d-muscles/MUSCLE-COVERAGE-AUDIT.md
```

Current runtime asset:

```txt
3d-muscles/bodyparts3d-fitness-taxonomy-draco.glb
3d-muscles/bodyparts3d-fitness-taxonomy-manifest.json
3d-muscles/body-model-contract.json
```

## Data Model Relationship

The product model has three layers:

```txt
一级组 group
  -> 二级 muscle id
      -> one or more 3D model targets / mesh nodes
```

Example:

```txt
chest
  -> pec_major_upper
  -> pec_major_mid
  -> pec_major_lower

current GLB:
  pec_major_upper -> muscle.pec_major_upper.right / left
  pec_major_mid -> muscle.pec_major_mid.right / left
  pec_major_lower -> muscle.pec_major_lower.right / left
```

The first-level group is for navigation and presentation only. The second-level
`muscle id` is the product-level canonical id used by exercise mapping,
deterministic stimulus calculation, click details, and 3D highlighting. The 3D
target is the runtime mesh node used for rendering and hit testing.

## Current State

The current BodyParts3D same-source GLB is accepted as the honest preview candidate because:

* skin and muscles share the same coordinate system
* the model has head, hands, feet, torso, and limbs
* there is no runtime skeleton dependency
* no procedural skin or invented muscle geometry is used
* reproductive anatomy has been flattened from the skin shell

The taxonomy asset generated on 2026-06-21 now has:

```txt
target muscles in taxonomy: 67
exact: 60
partial: 7
coarse fallback: 0
missing: 0
runtime muscle targets: 133
Draco GLB: 2.18MB
skin triangles: 29,702
muscle triangles: 119,320
armatures: 0
```

The 7 partial entries use real geometry but are composite fitness regions or
derived splits of a real source mesh:

```txt
erector_spinae_upper / erector_spinae_lower
forearm_flexors / forearm_extensors
rectus_abdominis_upper / rectus_abdominis_lower
iliopsoas
```

## Click And Highlight Policy

### Current Runtime Behavior

Runtime click flow:

```txt
click mesh
  -> hit model target
  -> resolve contract.muscles[muscle_id]
  -> exact: return the specific muscle id
  -> partial: return region and coverage explanation
  -> missing: no hit
```

For example, clicking the upper-chest target now returns:

```txt
区域: 胸部
模型粒度: exact
muscle id: pec_major_upper
```

`erector_spinae_lower` can be highlighted directly, but remains `partial` and
is not returned as an exact muscle click. It uses real
iliocostalis-lumborum geometry and never borrows lats or traps.

### Missing Muscles

For `coverage=missing`:

```txt
no mesh highlight
no hover target
no click hit testing
show numeric/list value only
```

This rule prevents false semantic coverage. Do not borrow unrelated meshes for missing muscles. For example, `serratus_anterior` must not be mapped to `chest`, `lats`, or `shoulders` unless a future contract explicitly marks it as an approximate non-final overlay.

Existing hard rule remains:

```txt
lower_back / erector-spinae must not borrow lats or traps for click/highlight.
```

## Coverage States

Each product muscle id should have one of these states in the model contract:

```txt
exact
partial
missing
```

| state   | meaning                                              | runtime behavior                                       |
| ------- | ---------------------------------------------------- | ------------------------------------------------------ |
| exact   | Dedicated mesh targets represent this muscle id.     | Can highlight and click as this exact muscle.          |
| partial | Some but not all expected visual subdivisions exist. | Can highlight available targets with partial label.    |
| missing | No valid mesh target exists.                         | No 3D highlight or click target; list/numeric UI only. |

## Iteration Roadmap

### Stage A: Contract Upgrade

Status: completed on 2026-06-21.

Goal: make `muscles.md` the authoritative product muscle taxonomy for 3D model work.

Work:

* Convert the 67 rows in `3d-muscles/muscles.md` into structured contract data.
* Add `coverage`, `model_groups`, `model_targets`, `pickable`, `highlightable`, and `notes` per muscle id.
* Keep first-level groups for navigation only.
* Reject broad-group substitutions for canonical muscle IDs.

Acceptance:

* Downstream can answer whether each muscle id is exact, approximate, or missing without reading source code.
* No frontend-only silent mapping is needed.

### Stage B: P0 Missing Geometry

Status: completed for the current 67-ID taxonomy. P0 entries use validated
BodyParts3D source geometry; composite functional regions remain `partial`.

Goal: add real same-pose geometry for P0 muscles that are currently missing.

Priority examples:

```txt
erector_spinae_upper
erector_spinae_lower
forearm_flexors
forearm_extensors
external_oblique
adductor_longus
adductor_magnus
tibialis_anterior
```

Work:

* Search BodyParts3D/FMA source STL files for matching structures.
* Validate alignment with the current BodyParts3D skin shell.
* Export as static GLB mesh nodes with stable names.
* Update manifest and contract.
* Verify in viewer and R3F PoC.

Acceptance:

* Added muscles are real imported anatomical geometry, not procedural approximations.
* New nodes are visible, aligned to the same body pose, and individually pickable.
* Missing P0 count decreases in `MUSCLE-COVERAGE-AUDIT.md`.

### Stage C: Split Coarse P0 Regions

Status: completed. Current contract has zero `coarse_fallback` entries.

Goal: replace high-value broad fallbacks with exact per-muscle targets.

Priority examples:

```txt
pec_major_upper / pec_major_mid / pec_major_lower
deltoid_anterior / deltoid_lateral / deltoid_posterior
biceps_long_head / biceps_short_head
triceps_long_head / triceps_lateral_head
rectus_abdominis_upper / rectus_abdominis_lower
rectus_femoris / vastus_lateralis / vastus_medialis
biceps_femoris_long_head / semitendinosus
gastrocnemius_medial / gastrocnemius_lateral / soleus
```

Work:

* Prefer real separate source meshes when available.
* If source meshes are anatomically split but too detailed, decimate or retopologize offline.
* Avoid drawing or inventing replacement muscle shapes.
* Preserve left/right mesh split where useful for future unilateral training display.

Acceptance:

* Click on a split mesh resolves to a specific child `muscle id`.
* Broad group fallback remains only where exact geometry is still absent.

### Stage D: P1 Professional Layer

Status: geometry and manifest completed. A dedicated normal/professional UI
toggle remains a downstream presentation enhancement.

Goal: add professional/rehab/deep-muscle coverage without cluttering the default view.

Examples:

```txt
serratus_anterior
supraspinatus
infraspinatus
teres_minor
subscapularis
rhomboid_major
levator_scapulae
teres_major
internal_oblique
transversus_abdominis
quadratus_lumborum
diaphragm
gluteus_minimus
iliopsoas
fibularis_longus
sternocleidomastoid
```

UI policy:

```txt
normal mode: P0 surface/high-frequency training muscles
professional mode: P1 deep or rehab-oriented muscles, often semi-transparent
```

Acceptance:

* P1 muscles are not forced into the default uncluttered view.
* Deep structures are visually understandable when enabled.

### Stage E: Runtime Optimization

Status: completed for size, draw calls, skin triangles, muscle triangles,
static runtime, and compression.

Goal: make the final asset suitable for web delivery.

Targets:

```txt
mobile GLB total: < 8MB
desktop GLB total: < 15MB
muscle triangles: < 120k
skin triangles: < 30k
draw calls: < 150
no runtime skeleton dependency
```

Work:

* Decimate or retopologize source meshes offline.
* Use Draco or meshopt compression.
* Keep stable node names after compression/export.
* Add Playwright 3D smoke tests and visual screenshots.

## Asset Source Rule

The model provider must not create visual coverage by drawing fake anatomy.

Allowed sources:

* BodyParts3D/FMA STL imported into the same coordinate system.
* Open3Dmodel / AnatomyTOOL geometry if pose and license are compatible.
* Z-Anatomy or other anatomy models only after license and pose validation.
* Manually simplified meshes derived from real anatomical source geometry, with provenance recorded.

Rejected:

* Procedural ellipsoids/cylinders pretending to be missing muscles.
* Mixed-source skin and muscle layers that do not share a pose.
* Texture-only muscle regions that cannot be clicked or highlighted by stable target id.
* Any runtime model where removing armature removes skin or muscles.

## Files To Keep In Sync

When the taxonomy or model coverage changes, update these together:

```txt
3d-muscles/muscles.md
3d-muscles/MUSCLE-COVERAGE-AUDIT.md
3d-muscles/body-model-contract.json
3d-muscles/bodyparts3d-fitness-taxonomy-manifest.json
3d-muscles/DOWNSTREAM-MAPPING.md
docs/body-3d/3D-MUSCLE-TAXONOMY-ITERATION.md
data/muscles/muscle_map.yaml
shared/fitness/schema.ts
shared/fitness/calculation.ts
shared/fitness/projection.ts
```

Downstream code should never invent a new mapping independently in the frontend.
