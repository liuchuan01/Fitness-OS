# Local 3D Experiment Workspace

The remote `ww` workstation was unavailable on 2026-06-21, so temporary 3D
research and Blender output may be produced locally under:

```txt
.tmp/3d-muscle-work/
  downloads/
  source/
  output/
  logs/
```

This directory is ignored by Git. It must contain only reproducible downloads,
extracted source geometry, Blender working files, logs, and intermediate
exports. Final reviewed assets belong in `3d-muscles/` and
`public/models/bodyparts3d/`.

Remove all local experiment data with:

```sh
rm -rf .tmp/3d-muscle-work
```

Do not delete reviewed GLB, manifest, contract, mapping, license, or provenance
files from `3d-muscles/`.
