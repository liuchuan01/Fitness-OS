# 3D Asset Delivery

## Downstream Runtime Bundle

Copy these three files together:

```txt
bodyparts3d-fitness-taxonomy-draco.glb
bodyparts3d-fitness-taxonomy-manifest.json
body-model-contract.json
```

Current application copies are under:

```txt
public/models/bodyparts3d/
```

Model-provider source and documentation:

```txt
muscles.md
bodyparts3d-muscle-source-map.json
MUSCLE-COVERAGE-AUDIT.md
DOWNSTREAM-MAPPING.md
README.md
```

## Checksums

```txt
dca6aa36b525b435b2b485bc07770b44d6e7f4074d694550d3e8639ce9fea9af  bodyparts3d-fitness-taxonomy-draco.glb
253744354dce16665dd94168eb7bf06c1e06e333ba45fd47aa547f8fef6ea31c  bodyparts3d-fitness-taxonomy-manifest.json
b155bfc517c32a220a20b8e5398e405a4deadc6ec819c45677fb351b56ac6130  body-model-contract.json
```

Regenerate checksums after any contract, manifest, or GLB update.

## Build Provenance

```txt
BodyParts3D repository revision:
f0eeb6e843380cfe6b83797cf8c3e1af74de5e61

Blender:
4.4.0 x86_64

Exporter:
export_bodyparts3d_taxonomy.py
```

Geometry remains subject to CC BY-SA 2.1 Japan.

## Verification

```sh
npm run validate:3d-source-map
npm run generate:3d-contract
npm run validate:3d-contract
npm run validate:3d-runtime
npm run generate:3d-audit
npm run typecheck
npm run test
npm run test:integration
npm run e2e
npm run build
```

`validate:3d-source-map` requires a local BodyParts3D checkout. The other
runtime validations use committed delivery files.

## Temporary Local Data

The reproducible experiment workspace is:

```txt
.tmp/3d-muscle-work/
```

During the local build it contained approximately 3GB of downloads, source STL
files, Blender binaries, working `.blend` files, and logs. It is ignored by Git
and is not part of the runtime delivery. The completed build workspace was
removed after verification on 2026-06-21.

Remove it after no further local Blender inspection is needed:

```sh
rm -rf .tmp/3d-muscle-work
```

The incompatible Homebrew Blender 4.5 installation was removed after the build.
If it is installed again, remove it with:

```sh
brew uninstall --cask blender
```
