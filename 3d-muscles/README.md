# 3D Muscles Asset Package

Current runtime asset: `1.0-bodyparts3d-fitness-taxonomy`.

The package provides a static web model with a transparent full-body skin shell
and fitness-oriented muscle targets. Skin and muscles use the same BodyParts3D
coordinate system. No armature, procedural muscle, or mixed-pose source is used.

## 预览与验证

独立 `viewer.html` 已于 2026-09-30 清理。运行仓库根目录的 `npm run dev`，在正式主站检查模型；自动验证使用 `npm run validate:3d-contract`、`npm run validate:3d-source-map`、`npm run validate:3d-runtime` 和 `npm run e2e`。当前入口与验收边界以 `docs/body-3d/3D-BODY-POC-VALIDATION.md` 为准。

## Runtime Files

```txt
bodyparts3d-fitness-taxonomy-draco.glb
bodyparts3d-fitness-taxonomy-manifest.json
body-model-contract.json
bodyparts3d-muscle-source-map.json
muscles.md
DOWNSTREAM-MAPPING.md
ASSET-DELIVERY.md
MUSCLE-COVERAGE-AUDIT.md
```

Downstream web applications need the GLB, manifest, and contract. Keep the
taxonomy, source map, audit, and mapping document with the model-provider
package for provenance and future regeneration.

## Verified Runtime Stats

```txt
taxonomy muscles: 67
first-level groups: 18
coverage: 60 exact / 7 partial / 0 coarse / 0 missing
runtime muscle targets: 133
Draco GLB: 2.18MB
skin triangles: 29,702
muscle triangles: 119,320
armatures: 0
genital region: flattened in the skin shell
```

The 7 `partial` entries use real source geometry but represent composite
fitness regions or a split of a real source mesh. They are not exact click
targets. See `MUSCLE-COVERAGE-AUDIT.md`.

## Source And License

Geometry source:

```txt
BodyParts3D v3.0 / 20110915
https://github.com/Kevin-Mattheus-Moerman/BodyParts3D
```

Geometry license: CC BY-SA 2.1 Japan.

Required attribution:

```txt
BodyParts3D, (c) The Database Center for Life Science licensed under
CC Attribution-Share Alike 2.1 Japan
```

Production distribution must review and accept the attribution and share-alike
obligations. This is a product/legal gate, not a technical limitation.

## Regeneration

The reproducible local workspace is documented in `LOCAL-WORKSPACE.md`.
Validate source geometry and metadata with:

```sh
npm run validate:3d-source-map
npm run generate:3d-contract
npm run validate:3d-contract
npm run generate:3d-audit
```

The Blender exporter is `export_bodyparts3d_taxonomy.py`. It imports only the
real source meshes listed in `bodyparts3d-muscle-source-map.json`.

Legacy v0.2-v0.4 binaries, manifests, screenshots, and exporters were removed
from this delivery directory after the taxonomy asset superseded them. Their
research conclusions remain in `docs/body-3d/3D-MODEL-ASSET-RESEARCH.md`.
