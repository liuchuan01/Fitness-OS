# 3D Model Asset Research - Fitness Body Visualization

Date: 2026-06-20

## Verified Research Run

Temporary workspace:

```txt
/tmp/fitness-3d-research
```

Pulled or downloaded:

* `Z-Anatomy/Models-of-human-anatomy`
* `djansma/open3dviewer`
* Open3Dmodel upper-limb and lower-limb GLB zips
* `makehumancommunity/mpfb2`

Local tooling limitation:

* Blender is not installed on this machine.
* This run verified source packages, licenses, GLB metadata, file sizes, node names, and render complexity.
* It did not generate a new `skin.glb` from MPFB or export a reduced muscle layer from Blender.

## Goal

Find a 3D model source suitable for AI Fitness OS:

* human body silhouette
* clear surface muscle shapes
* muscles can be colored by canonical muscle id
* no runtime skeleton dependency
* no visible bones, organs, or reproductive anatomy
* lightweight enough for Web 3D
* legal to modify, optimize, and distribute in the app

Target from `../../engineering/TECHNICAL-ARCHITECTURE.md`:

```txt
mobile GLB total: < 8MB
desktop GLB total: < 15MB
triangles: < 150k
draw calls: < 150
```

## Retired STL Demo Diagnosis

The retired BodyParts3D STL demo proved that Three.js can load anatomical parts, but its implementation and assets have been removed and must not be used as production runtime assets.

Observed locally:

```txt
BodyParts3D folder: 204MB
FMA7163.stl full skin: 76MB
FMA7163-lite.stl: 5.4MB
multiple muscle STL files: commonly 1-11MB each
```

Problems:

* runtime loads many STL files instead of compact GLB
* STL has no stable material/node metadata for product-level muscle mapping
* asset size is far above the mobile target
* medical atlas granularity is too detailed for a fitness heatmap
* original license is CC BY-SA 2.1 Japan, so derived production assets may inherit ShareAlike obligations

Conclusion:

Do not use raw BodyParts3D STL files in production. Keep them only as anatomical reference and as a possible geometry source for an offline derived prototype.

## Real Package Findings

### Z-Anatomy

Command/source:

```txt
git clone --depth 1 https://github.com/Z-Anatomy/Models-of-human-anatomy.git
```

Observed locally:

```txt
repository checkout: 218MB
Z-Anatomy.zip: 83MB
Z-Anatomy/Startup.blend inside zip: 306,838,281 bytes
```

Package shape:

```txt
Z-Anatomy.zip
  Z-Anatomy/Startup.blend
  Z-Anatomy/Anatomy-shortcuts.py
  Z-Anatomy/*.xml
  Z-Anatomy/__init__.py
```

Interpretation:

Z-Anatomy is a Blender anatomy atlas template. It is useful for inspecting anatomy, selecting structures, and possibly extracting simplified source geometry, but it is not a direct Web runtime asset.

Hard blocker for production as-is:

* CC BY-SA 4.0 license requires attribution and same-license distribution of derivatives.
* The package attribution notes include some referenced/included material with non-commercial terms, so any extracted object set needs per-object provenance review.
* `Startup.blend` is too large and too complete for the product target.

### Open3Dmodel / AnatomyTOOL

Sources:

* `https://anatomytool.org/open3dmodel-create`
* `https://github.com/djansma/open3dviewer`

Viewer:

```txt
open3dviewer repository: 8.1MB
viewer license: GPL-3.0
demo GLB: 988KB
```

The viewer can load remote/self-hosted `.glb` files and supports selecting, hiding, subsets, export mode, and a right-to-left mirroring convention for some structures.

Downloaded test assets:

```txt
upper-limb-glb.zip: 6.1MB
upper-limb.glb: 6,911,588 bytes

lower-limb-glb.zip: 6.0MB
lower-limb.glb: 6,184,984 bytes
```

GLB metadata inspection:

```txt
upper-limb.glb
  generator: Khronos glTF Blender I/O v4.4.56
  extensions: KHR_draco_mesh_compression, KHR_materials_clearcoat, KHR_materials_specular, KHR_materials_ior
  nodes: 575
  meshes: 532
  materials: 95
  estimated triangles from indices: 1,368,260
  glTF Transform renderVertexCount: 4,104,780
  uploadVertexCount: 760,842

lower-limb.glb
  generator: Khronos glTF Blender I/O v4.4.56
  extensions: KHR_draco_mesh_compression, KHR_materials_clearcoat, KHR_materials_transmission, KHR_materials_specular, KHR_materials_ior
  nodes: 462
  meshes: 452
  materials: 68
  estimated triangles from indices: 1,192,394
  glTF Transform renderVertexCount: 3,577,182
  uploadVertexCount: 665,370
```

Useful node names found:

```txt
upper limb:
  Brachialis muscle.r
  Long head of biceps brachii.r
  Short head of biceps brachii.r
  Lateral head of triceps brachii.r
  Deltoid muscle.r
  Pectoralis major.r
  Latissimus dorsi.r
  Trapezius muscle.r

lower limb:
  Gluteus maximus muscle.r
  Rectus femoris.r
  Vastus lateralis muscle.r
  Vastus medialis muscle.r
  Long head of biceps femoris.r
  Semitendinosus muscle.r
  Semimembranosus muscle.r
  Soleus muscle.r
  Medial head of gastrocnemius.r
  Lateral head of gastrocnemius.r
```

Interpretation:

Open3Dmodel is better than raw BodyParts3D as a source/reference because it already provides web GLB packages, clean English node names, Blender-exported hierarchy, and anatomist-reviewed/retopologized structures. However, the downloaded regional GLBs are still far beyond MVP runtime complexity. They are compressed on disk, but not lightweight after GPU upload or vertex processing.

Decision after experiment:

Use Open3Dmodel as the preferred anatomical reference and possible Blender extraction source for the muscle layer, ahead of raw BodyParts3D. Do not ship the downloaded full regional GLBs as runtime app assets.

### MPFB2 / MakeHuman

Command/source:

```txt
git clone --depth 1 https://github.com/makehumancommunity/mpfb2.git
```

Observed locally:

```txt
repository checkout: 104MB
src folder: 78MB
requires Blender >= 4.2
```

License finding:

MPFB separates code and assets:

* source code: GPLv3
* bundled assets: CC0 1.0 Universal
* MPFB output: treated by the MakeHuman team as user data, with no claim over exports, renderings, screenshots, saved model files, or generated graphical data

Export finding:

MPFB documentation recommends:

* create an export copy
* use GameEngine materials for external applications
* bake shape keys
* delete helper geometry
* handle delete/mask groups
* export selected hierarchy

Interpretation:

MPFB2 remains the best source for `skin.glb`, but it requires a Blender 4.2+ environment to produce and inspect the actual output. The output should be generated as static mesh with no runtime armature dependency.

## Remote Blender Experiment on `ww`

Machine:

```txt
host: ww
workspace: /home/torchv/fitness-3d-blend-exp
available memory observed by Linux: ~46GiB
disk available: ~352GB
```

Installed in user directory, without system package changes:

```txt
/home/torchv/fitness-3d-blend-exp/bin/blender-4.2.0-linux-x64/blender
/home/torchv/fitness-3d-blend-exp/bin/blender-4.4.3-linux-x64/blender
```

Important version finding:

* Open3Dmodel `.blend` files were written by a newer Blender binary than 4.2.
* Blender 4.2 can open them, but prints a newer-binary warning.
* Blender 4.4.3 should be the production authoring version for these source files.

Downloaded source files:

```txt
upper-limb-blender.zip: 29MB
upper-limb.blend: 82MB

lower-limb-blender.zip: 25MB
lower-limb.blend: 70MB
```

Headless inspection with Blender:

```txt
upper-limb.blend
  objects: 575
  mesh objects: 532
  materials: 95
  total vertices: 706,237
  total polygons: 775,646
  muscle-like objects: 74
  muscle-like vertices: 60,194
  muscle-like polygons: 70,756

lower-limb.blend
  objects: 462
  mesh objects: 452
  materials: 70
  total vertices: 617,233
  total polygons: 660,588
  muscle-like objects: 73
  muscle-like vertices: 59,881
  muscle-like polygons: 59,288
```

This confirms Open3Dmodel is suitable as a Blender authoring source: the complete regional files are heavy, but the actual visible muscle candidates are already small enough to extract.

Experiment output:

```txt
/home/torchv/fitness-3d-blend-exp/out/fitness-muscles-subset-44.blend
  size: 9.3MB
  static mesh objects: 94
  source vertices: 65,054
  source polygons: 81,206

/home/torchv/fitness-3d-blend-exp/out/fitness-muscles-subset-44.glb
  size: 2.7MB
  nodes: 94
  meshes: 94
  materials: 17
  triangles in exported GLB: 123,998
  animations: none

/home/torchv/fitness-3d-blend-exp/out/fitness-muscles-subset-draco.glb
  size: 606KB

/home/torchv/fitness-3d-blend-exp/out/body-model-manifest-experiment-44.json
  size: 9.7KB
```

The exported node names follow the intended runtime convention:

```txt
muscle.chest.right.pectoralis_major
muscle.chest.left.pectoralis_major
muscle.lats.right.latissimus_dorsi
muscle.lats.left.latissimus_dorsi
muscle.quadriceps.right.rectus_femoris
muscle.quadriceps.left.rectus_femoris
```

Mapped fitness IDs in this experiment:

```txt
chest
front_delts
side_delts
rear_delts
biceps
triceps
forearms
lats
traps
upper_back
glutes
abductors
quadriceps
hamstrings
calves
hip_flexors
adductors
```

Not covered by the Open3Dmodel upper/lower limb source files used in this experiment:

```txt
abs
obliques
lower_back
```

Implication:

Open3Dmodel upper/lower source files are a strong choice for limb, shoulder, chest, upper back, and hip/leg muscles. They do not fully solve the core/trunk layer. The downstream asset plan must either:

* wait for / locate an Open3Dmodel trunk source package,
* use Z-Anatomy or BodyParts3D as fallback for trunk/core muscles,
* or hand-author simplified `abs`, `obliques`, and `lower_back` meshes to match the visual style.

Pipeline finding:

Directly exporting GLB in the same Blender process that loads objects from external `.blend` libraries produced an empty 132-byte GLB. Saving the extracted subset as a clean intermediate `.blend`, then opening that file in a second Blender process and exporting GLB worked reliably.

Production pipeline should therefore be:

```txt
source .blend files
  -> Blender script extracts and renames target objects
  -> save clean muscles-source.blend
  -> second Blender process exports muscles.glb
  -> optimize/compress GLB
  -> validate node names and manifest
```

## Failed v0.2 Procedural Experiment

Local package:

```txt
/Users/liuchuan/CodeEnv/dev2learn/training/3d-muscles
```

Do not use these files as product assets:

```txt
body-model-manifest.json
skin.glb
skin.blend
muscles-complete.glb
muscles-complete-draco.glb
muscles-complete.blend
generate_complete_body.py
viewer-complete-preview.png
```

Reason:

The added skin and missing muscles were generated from procedural ellipsoids/cylinders. That made the preview technically loadable but visually and anatomically invalid. It does not satisfy the requirement for a real human silhouette plus credible fitness muscle geometry.

## v0.3 MPFB + Open3Dmodel Partial Real Package

Active manifest:

```txt
3d-muscles/body-model-manifest-mpfb-open3d-v0.3.json
```

Active runtime files:

```txt
skin-mpfb-aligned.glb
skin-mpfb-aligned-draco.glb
fitness-muscles-subset-44.glb
fitness-muscles-subset-draco.glb
viewer.html
```

Skin layer:

```txt
source: MPFB / MakeHuman basemesh generated in Blender 4.4.3
license: MakeHuman / MPFB core assets CC0 1.0 Universal
mesh objects: 1
vertices: 13,380
polygons: 13,378
armatures: 0
textures in exported GLB: 0
```

The MPFB skin export initially referenced MakeHuman texture files that were Git LFS pointers in the checkout. For this product use case, texture detail is unnecessary and undesirable; the skin should function as a lightweight translucent shell. The export script therefore replaces the skin material with a simple translucent material and exports a static mesh.

Muscle layer:

```txt
source: Open3Dmodel upper-limb + lower-limb extracted subset
groups: 17
targets: 94
skins/armatures/animations: 0
```

Local preview verification:

```txt
http://127.0.0.1:8080/viewer.html
status: loaded: skin + muscles
badge: 17 groups / 94 targets
console errors: none
screenshot: 3d-muscles/viewer-mpfb-open3d-v0.3-preview.png
```

Current covered fitness groups:

```txt
chest
front_delts
side_delts
rear_delts
biceps
triceps
forearms
lats
traps
upper_back
glutes
abductors
quadriceps
hamstrings
calves
hip_flexors
adductors
```

Missing or incomplete:

```txt
abs
obliques
deep_core
lower_back
neck_front
neck_back
tibialis_anterior
rotator_cuff
hip_external_rotators
forearm_flexors_extensors_detail
chest_upper_middle_lower_visual_regions
```

Conclusion:

v0.3 was rejected after visual inspection. MPFB skin and Open3Dmodel muscles are both real assets, but they do not share the same default pose, so bounding-box alignment produces a visibly broken human body. Do not use this mixed-source package as the downstream default.

## Archived v0.4 BodyParts3D Same-Source Full-Skin Candidate

Historical manifest:

```txt
3d-muscles/bodyparts3d-fullskin-no-genitals-same-source-manifest.json
```

Historical runtime files:

```txt
bodyparts3d-fullskin-no-genitals-same-source-draco.glb
bodyparts3d-fullskin-no-genitals-same-source-manifest.json
viewer.html
```

Why this candidate replaced v0.3:

* skin and muscle meshes come from the same BodyParts3D coordinate system
* the skin has head, hands, feet, torso, and limbs
* no runtime skeleton, skinning, or animation is required
* no procedural muscle or procedural skin geometry is used in the active preview

Current stats:

```txt
source: BodyParts3D selected STL files
license: CC BY-SA 2.1 Japan
groups: 11
targets: 40
draco GLB: 15MB
armatures: 0
genital region: flattened in the skin shell
```

Viewer changes:

* the default preview loads this no-genitals manifest
* skin remains low-opacity and translucent
* muscle materials are rendered brighter with higher opacity and a small emissive term

Archive note:

The v0.4 GLB, manifest, screenshots, and exporter were removed from
`3d-muscles/` and `public/models/bodyparts3d/` after the v1.0 taxonomy asset
superseded them. This section is retained only as research history.

Covered fitness groups:

```txt
chest
shoulders
biceps
triceps
lats
traps
glutes
quadriceps
hamstrings
calves
abs
```

Still missing or incomplete:

```txt
obliques
deep_core
lower_back
neck_front
neck_back
tibialis_anterior
rotator_cuff
hip_external_rotators
forearm_flexors_extensors_detail
chest_upper_middle_lower_visual_regions
adductors
abductors
hip_flexors
forearms
upper_back_detail
```

Conclusion:

The `1.0-bodyparts3d-fitness-taxonomy` asset supersedes v0.4 for downstream
integration. It keeps the same-source pose guarantee and expands the runtime to
67 product muscle IDs, 133 targets, 60 exact and 7 partial entries. The Draco
GLB is 2.18MB with no armature.

Current taxonomy and coverage planning:

```txt
3d-muscles/muscles.md
3d-muscles/MUSCLE-COVERAGE-AUDIT.md
docs/body-3d/3D-MUSCLE-TAXONOMY-ITERATION.md
```

The remaining production gate is the BodyParts3D CC BY-SA 2.1 Japan license
review. Geometry coverage and web weight no longer require a different asset
for the current taxonomy.

Important interaction rule:

```txt
click mesh -> model target -> contract muscle id -> coverage policy
```

An `exact` target returns its specific child muscle ID. A `partial` target may
be highlighted but must return a region/coverage explanation instead of an
exact anatomical claim.

## Candidate Evaluation

### 1. MakeHuman / MPFB for `skin.glb`

Use for:

* neutral skin silhouette
* complete head, hands, feet, torso, and limbs
* semi-transparent outer body layer

Why it fits:

* exported models are described by MakeHuman as CC0, allowing commercial use, modification, and redistribution
* no need to keep rig/skeleton for a static visualization
* easy to generate a neutral, non-sexualized, simplified body shell

Limitations:

* does not provide separate muscle geometry
* exported skin should still be inspected and cleaned in Blender before shipping

Decision:

Recommended source for `skin.glb`. This is stronger after the real MPFB2 repository/license inspection, but the actual skin export still needs a Blender 4.2+ run.

### 2. Z-Anatomy for muscle reference / possible prototype source

Use for:

* surface muscle reference
* possible Blender-side extraction of a reduced muscle layer
* canonical muscle naming research

Why it fits:

* Blender-based anatomical model
* derived from BodyParts3D and reorganized/retopologized
* explicit CC BY-SA 4.0 license
* likely easier to inspect and process than raw STL folders

Risks:

* ShareAlike license is not ideal for closed or proprietary asset distribution
* repository includes notes that some referenced/included models may have non-commercial licenses, so any selected objects need license tracing
* still too complete for the MVP unless heavily reduced

Decision:

Useful research/prototype candidate. After inspecting the real package, it should not be the default production source unless ShareAlike release of the derived model is acceptable and per-object provenance has been checked.

### 3. Open3Dmodel / AnatomyTOOL

Use for:

* reference for improved anatomical shapes
* preferred anatomical source/reference for extracting simplified muscle geometry
* validating muscle node naming and hierarchy

Why it fits:

* project builds on Z-Anatomy and reports retopologizing and reviewing structures with anatomists
* provides downloadable `.glb`, `.blend`, and `.obj` packages
* GLB nodes have useful English anatomical names
* web packages use Draco compression and are already structured for interactive hiding/selection

Risks:

* still inherits CC BY-SA lineage
* product needs a fitness map, not a full anatomy atlas
* tested regional GLBs are much too heavy after decompression/rendering
* some muscle textures on the create page are based on CC BY-NC-SA material, so texture provenance must be reviewed or avoided

Decision:

Promote to preferred anatomical reference and possible Blender extraction source. Do not ship the full downloaded regional GLBs directly.

### 4. BodyParts3D

Use for:

* anatomical reference
* fallback geometry source for selected muscles only
* mapping from FMA concepts to canonical fitness muscles

Why it fits:

* already split by anatomical parts
* current demo proves basic loading and muscle highlighting

Risks:

* local asset set is 204MB
* skin STL alone is 76MB
* source format is not suitable for runtime
* CC BY-SA 2.1 Japan attribution and inheritance obligations

Decision:

Keep as fallback/reference only. Do not ship raw STL files.

### 5. Sketchfab free models

Examples found:

* "Male base muscular anatomy" by CharacterZone: CC Attribution and described as usable for AR/VR, games, and movies.
* Multiple muscular system models exist, but many are high-poly, rigged, store assets, or have vague educational-use wording.

Why it can fit:

* fast visual prototype
* some assets already downloadable in web-friendly formats

Risks:

* variable quality and inconsistent object naming
* many models are one merged mesh, making muscle-specific coloring hard
* license must be checked per asset
* author attribution and provenance are weaker than institutional sources
* high-poly examples exceed the MVP triangle target

Decision:

Acceptable for throwaway visual prototypes only. Not recommended as production source unless an exact asset passes a license and mesh-structure audit.

### 6. Commercial marketplaces: TurboSquid / CGTrader

Use for:

* paid fallback if open-source-derived assets are blocked

Why it can fit:

* many anatomy models are visually polished
* some are already game/AR/VR oriented

Risks:

* marketplace royalty-free licenses often forbid redistributing the raw model or making it directly available to third parties
* browser-delivered GLB is effectively downloadable
* per-asset licenses vary
* models may include skeletons, organs, reproductive anatomy, or overly high-poly meshes

Decision:

Not default. Only viable after written confirmation that web distribution of optimized GLB assets is allowed.

### 7. BioDigital

Use for:

* hosted anatomy viewer integration
* medical-grade interactive anatomy in an iframe/API

Why it can fit:

* developer toolkit supports embedded interactive body experiences and object IDs
* high-quality medical anatomy coverage

Risks:

* not a local `skin.glb + muscles.glb` asset pipeline
* proprietary dependency and likely recurring licensing
* harder to own the exact Cyberpunk HUD visual treatment
* offline/local-first app architecture becomes harder

Decision:

Not suitable for the current local-first 3D asset strategy. Could be reconsidered only if the product pivots to a licensed hosted anatomy viewer.

## Recommended Direction

Use a hybrid source pipeline:

```txt
skin.glb:
  MakeHuman / MPFB generated neutral body shell

muscles.glb:
  custom simplified surface muscle meshes
  based primarily on Open3Dmodel as anatomical reference
  Z-Anatomy / BodyParts3D kept as fallback/reference
  not raw runtime assets
```

This best matches the product need: the user does not need a full anatomy atlas; they need a clear fitness-oriented body map.

After the real GLB inspection, the production muscle asset should not try to preserve anatomical atlas granularity. It should be a deliberately simplified fitness mesh:

```txt
target muscles.glb:
  40-80 visual meshes, including left/right splits
  20-50 canonical training muscle ids
  < 120k triangles for muscle layer
  no normal-map dependency
  no bones, vessels, nerves, bursae, ligaments, or tendons unless visually required
```

The muscle layer should be simplified to 20-50 training regions:

```txt
chest
front_delts
side_delts
rear_delts
biceps
triceps
forearms
lats
traps
upper_back
lower_back
abs
obliques
glutes
quadriceps
hamstrings
calves
hip_flexors
adductors
abductors
```

The newer detailed taxonomy in `3d-muscles/muscles.md` expands this into 67 product muscle ids across P0/P1. The runtime can still present simplified normal-mode regions, but the model contract must preserve the child muscle ids for exercise mapping and future exact click targets.

Planned model granularity:

```txt
normal mode:
  P0 surface/high-frequency training muscles

professional mode:
  P1 deep, rehab, shoulder-scapular, ankle/foot, neck, and core stabilizer muscles
```

The production viewer should keep first-level muscle groups for navigation and aggregation, but should not stop at group-only rendering. The final asset should map child `muscle id` values to real mesh targets wherever possible.

Implementation note:

Do not depend on skeleton removal. The production body viewer should use static meshes with stable node names:

```txt
muscle.chest.left
muscle.chest.right
muscle.lats.left
muscle.lats.right
...
```

## Asset Acceptance Checklist

Before accepting a model into `public/models/body/`:

* source URL and license are recorded
* redistribution in a browser-delivered app is allowed
* no runtime skeleton dependency
* removing armature does not remove skin or muscles
* no bones, organs, or reproductive anatomy are visible
* head, hands, and feet remain complete
* all muscles map to canonical muscle ids
* node names are stable and documented
* total optimized GLB size meets target
* triangle count is below target
* model renders in a Playwright 3D smoke test

## First PoC Plan

1. Install Blender 4.2+.
2. Install MPFB2 and the MakeHuman system asset pack.
3. Generate neutral `skin-source.blend`.
4. Create an MPFB export copy with GameEngine material.
5. Bake shape keys, remove helper geometry, remove armature, and export `skin.glb`.
6. In Blender, load Open3Dmodel upper/lower source `.blend` packages.
7. Extract only MVP surface muscles and merge them into canonical fitness groups.
8. Rename objects to stable IDs such as `muscle.lats.left`.
9. Remove bones, vessels, nerves, tendons, bursae, ligaments, and atlas-only structures.
10. Decimate / retopologize to target:
   * muscle layer: < 120k triangles
   * skin layer: < 30k triangles
11. Export uncompressed GLB and inspect node names.
12. Optimize with glTF Transform or gltfpack using meshopt.
13. Record:
   * GLB size
   * triangle count
   * draw calls
   * desktop FPS
   * mobile viewport screenshot
14. Wire into R3F with hover/click color changes.

## Updated Decision

The production asset should not be selected as a single downloaded human anatomy model.

The right path is asset authoring:

```txt
skin:
  MPFB2 / MakeHuman generated static mesh
  CC0-friendly output

muscle reference:
  Open3Dmodel first
  Z-Anatomy and BodyParts3D only as fallback references

runtime:
  custom simplified GLB
  static meshes
  stable canonical node names
  no skeleton
  no atlas-level detail
```

This directly addresses the current failure mode: removing skeletons should never delete skin or muscles because the runtime model should not depend on armature deformation at all.

## Web Delivery Decision

`.blend` is not a Web delivery format for this project.

Use `.blend` only as an authoring/intermediate format:

```txt
source/reference .blend
  -> Blender cleanup / extraction / retopology
  -> canonical object naming
  -> export GLB
  -> glTF optimization
  -> browser runtime
```

Reasons:

* browsers cannot render `.blend` directly
* `.blend` files carry Blender-specific scene data, modifiers, materials, collections, helpers, rigs, and scripts
* `.blend` source packages are too large for runtime delivery
* product UI needs predictable mesh IDs, not arbitrary Blender scene organization
* Web runtime should use Three.js/R3F `GLTFLoader` with `.glb`

Final Web asset contract:

```txt
public/models/body/
  skin.glb
  muscles.glb
  body-model-manifest.json
```

`body-model-manifest.json` maps product muscle IDs to GLB node names:

```json
{
  "version": "0.1",
  "source": {
    "skin": "MPFB2 generated export",
    "muscles": "Custom simplified mesh based on Open3Dmodel reference"
  },
  "targets": {
    "lats": ["muscle.lats.left", "muscle.lats.right"],
    "biceps": ["muscle.biceps.left", "muscle.biceps.right"]
  }
}
```

The app must never depend on Blender collections, Blender material names, armatures, or source anatomical names at runtime.

## Downstream Selection Guide

The downstream team should choose this route unless a licensing or asset-production blocker appears:

```txt
Selected route:
  skin source: MPFB2 / MakeHuman
  muscle reference source: Open3Dmodel
  runtime format: optimized GLB
  runtime structure: static named meshes
  runtime mapping: manifest from fitness muscle ids to mesh node names
```

How to use each selected source:

```txt
MPFB2 / MakeHuman
  Use only to generate neutral skin silhouette.
  Export as static mesh.
  Remove armature, helpers, shape-key dependency, clothes, hair, teeth if unnecessary.
  Keep head, hands, feet, torso, and limbs complete.
  Output: skin.glb.

Open3Dmodel
  Use as anatomical reference/source for visible surface muscle shape.
  Load regional .blend source files in Blender.
  Select only muscles relevant to fitness visualization.
  Delete bones, vessels, nerves, bursae, ligaments, organs, and reproductive structures.
  Merge detailed anatomical parts into canonical fitness muscle groups.
  Retopologize/decimate aggressively.
  Rename final objects with stable product IDs.
  Output: muscles.glb.

Z-Anatomy / BodyParts3D
  Use only as fallback references when Open3Dmodel is missing a structure or shape is unsuitable.
  Do not make them default runtime assets.
```

Reject a candidate asset if any of these are true:

* it must keep a skeleton/armature for skin or muscle visibility
* muscles are only texture paint on one merged body mesh
* muscle regions cannot be selected as objects or stable material/vertex groups
* browser redistribution rights are unclear
* optimized runtime triangle count cannot meet the MVP budget
* it contains required bones/organs/reproductive geometry that cannot be removed cleanly

## Fitness Muscle Mapping Requirement

The final product interface is not medical anatomy. It is a fitness training model.

All source anatomical structures must be mapped into canonical fitness muscle IDs before entering app data or runtime rendering. The app should never expose FMA IDs, Open3Dmodel names, or Z-Anatomy labels as primary identifiers.

MVP canonical muscle IDs:

```txt
chest
front_delts
side_delts
rear_delts
biceps
triceps
forearms
lats
traps
upper_back
lower_back
abs
obliques
glutes
quadriceps
hamstrings
calves
hip_flexors
adductors
abductors
```

Source-to-fitness mapping examples:

```txt
Pectoralis major
  -> chest

Clavicular head of pectoralis major
Sternocostal head of pectoralis major
Abdominal head of pectoralis major
  -> chest

Clavicular/anterior part of deltoid
  -> front_delts

Acromial/middle part of deltoid
  -> side_delts

Spinal/posterior part of deltoid
  -> rear_delts

Long head of biceps brachii
Short head of biceps brachii
Brachialis
  -> biceps

Long/lateral/medial head of triceps brachii
  -> triceps

Latissimus dorsi
  -> lats

Trapezius descending/transverse/ascending parts
  -> traps

Rhomboid major/minor, teres major/minor, infraspinatus
  -> upper_back

Rectus abdominis
  -> abs

External/internal oblique
  -> obliques

Gluteus maximus
  -> glutes

Gluteus medius/minimus
  -> abductors

Rectus femoris, vastus lateralis, vastus medialis, vastus intermedius
  -> quadriceps

Long/short head of biceps femoris, semitendinosus, semimembranosus
  -> hamstrings

Gastrocnemius medial/lateral head, soleus
  -> calves

Iliacus, psoas major
  -> hip_flexors

Adductor longus/brevis/magnus, gracilis, pectineus
  -> adductors
```

Mapping output should live in a separate data file, for example:

```txt
data/muscles/muscle_map.yaml
```

Example:

```yaml
lats:
  label_zh: 背阔肌
  region: back
  model_targets:
    - muscle.lats.left
    - muscle.lats.right
  source_terms:
    - Latissimus dorsi.r
    - Latissimus dorsi.l
```

This keeps training logic, AI prompts, workout data, and 3D rendering aligned to the same fitness-language contract.

## Hardware Note

Using `.blend` in this workflow means using Blender for asset authoring, not for final delivery.

The current Intel Mac + 6900XT can be used for source inspection and moderate Blender cleanup if Blender is installed. The heavy parts are likely:

* opening 300MB-class `.blend` anatomy source files
* selecting/extracting hundreds of objects
* decimation/retopology
* exporting and optimizing GLB

These are more CPU/RAM/workflow bound than NPU bound. A Ryzen AI 9 HX 370 machine may help if it has more available RAM, faster single-core/multi-core CPU performance, and a smoother Blender setup, but the NPU is not relevant for this asset pipeline. The decisive requirement is not peak GPU power; it is having Blender 4.2+, enough RAM, and a repeatable export script.

## Sources

* MakeHuman export license FAQ: https://static.makehumancommunity.org/oldsite/faq/can_i_sell_models_created_with_makehuman.html
* MakeHuman license explanation: https://www.makehumancommunity.org/content/license_explanation.html
* MPFB2 repository: https://github.com/makehumancommunity/mpfb2
* MPFB2 getting started: https://static.makehumancommunity.org/mpfb/docs/getting_started.html
* MPFB2 exporting: https://static.makehumancommunity.org/mpfb/docs/exporting.html
* Z-Anatomy human model repository: https://github.com/Z-Anatomy/Models-of-human-anatomy
* Open3Dmodel project background: https://anatomytool.org/open3dmodel-about
* Open3Dmodel create/download page: https://anatomytool.org/open3dmodel-create
* Open3D viewer repository: https://github.com/djansma/open3dviewer
* BodyParts3D Anatomography: https://lifesciencedb.jp/bp3d/?lng=en
* TurboSquid 3D Model License: https://blog.turbosquid.com/turbosquid-3d-model-license/
* BioDigital developer toolkit: https://www.biodigital.com/product/developer-toolkits
* BioDigital Viewer API overview: https://developer.biodigital.com/docs/getting-started%2Foverview
* Sketchfab example, Male base muscular anatomy: https://sketchfab.com/3d-models/male-base-muscular-anatomy-0954aa04666d45aab9633009318f7b66
* Sketchfab example, Muscle system in human body: https://sketchfab.com/3d-models/muscle-system-in-human-body-muscular-system-7ea21567ff9942bf9511e2d99efe85d9
