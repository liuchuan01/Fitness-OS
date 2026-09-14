# 3D Body PoC Validation

Date: 2026-06-21

## Runtime Assets

Active app assets are served from `public/models/bodyparts3d/`:

```txt
bodyparts3d-fitness-taxonomy-draco.glb
bodyparts3d-fitness-taxonomy-manifest.json
body-model-contract.json
```

Source package:

```txt
3d-muscles/bodyparts3d-fitness-taxonomy-draco.glb
3d-muscles/bodyparts3d-fitness-taxonomy-manifest.json
3d-muscles/body-model-contract.json
```

Draco decoder files are served from `public/draco/`.

## License Record

Geometry source: BodyParts3D selected STL files.

License: CC BY-SA 2.1 Japan.

Production note: this license has share-alike obligations. Before production release, either accept and document those obligations or replace the geometry with a production-cleared model.

## Model Safety Record

Current asset package records:

```txt
armatures: 0
genital_region_flattened: true
runtime: static GLB
```

The active preview does not include bones, internal organs, or genital meshes as product-visible assets. It is still a preview asset, not final medical/anatomy coverage.

## Coverage

Coverage:

```txt
60 exact
7 partial
0 coarse_fallback
0 missing
```

Partial:

```txt
erector_spinae_upper / erector_spinae_lower
forearm_flexors / forearm_extensors
rectus_abdominis_upper / rectus_abdominis_lower
iliopsoas
```

`lower_back` highlights only real `erector_spinae_lower` partial geometry. It
does not borrow lats or traps and does not claim an exact per-muscle click.

## Remaining Product Gates

Detailed taxonomy and iteration plan:

```txt
3d-muscles/muscles.md
3d-muscles/MUSCLE-COVERAGE-AUDIT.md
docs/body-3d/3D-MUSCLE-TAXONOMY-ITERATION.md
```

Remaining work is product integration rather than missing geometry: migrate
exercise mappings from 11 aggregates to 67 IDs, add a professional-mode
display toggle, and complete the CC BY-SA production review.

## Interaction Implemented

```txt
R3F Canvas
Draco GLB load
Orbit rotate / pan / zoom
Reset view
Hover highlight
Click multi-select
Clear selection
Deterministic stimulus heat color mapping
Desktop and mobile smoke coverage
```

## Performance Record

Current source manifest stats:

```txt
GLB size: 2.18MB
mesh_objects: 134
muscle targets: 133
vertices: 75692
skin triangles: 29702
muscle triangles: 119320
armatures: 0
```

Current phase decision:

```txt
Mobile and desktop file-size gates pass.
Skin triangle and draw-call targets pass.
Muscle triangles pass the 120k target.
```

Remaining runtime measurements:

```txt
runtime draw-call capture
mobile FPS capture
```

Conclusion: functional loading, mapping, heat color, exact click selection, reset
view, responsive layout, compression, and static asset budgets are validated.

## 当前产品集成更新

上述 Click multi-select 是历史 POC 记录。当前第一步改为页面持有的单选 Muscle Focus，选中后更新训练档案；文字入口覆盖键盘、partial 和 WebGL 不可用场景。动作高亮通过独立 targets 传入，不改 intensity、不缩放网格。详见 [肌肉训练档案契约](../data/MUSCLE-HISTORY.md)。

## 当前身体探索与运动实现

默认自转已恢复：`BodyMotion` 在 demand Canvas 上以不高于 24 Hz 调度模型组旋转，DPR 上限 1.25；探索、肌肉焦点、拖动期间暂停，后台不自动调度，reduced-motion 降低旋转速度而不禁止启动；删除播放／暂停按钮。运动调度由独立定时器请求 demand 绘制，不依赖上一渲染帧续接；角速度按实际帧间隔计算。分区预览只更新材质，不重建几何或修改领域强度。重置视角同时归零模型旋转。`tests/e2e/body-explorer.spec.ts` 使用实际 WebGL 像素变化验证旋转／静止／恢复，并覆盖两层 HUD、手机长列表点选与四角数据可见性。限频是资源控制策略，不宣称所有设备实测达到 24 FPS。
