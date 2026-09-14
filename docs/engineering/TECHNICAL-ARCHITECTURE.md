# AI Fitness OS - Technical Architecture v0.1

## 1. 技术原则

第一版技术栈服务于 Layer 1 和 Layer 2：

* 真实训练记录和计划生成闭环。
* 肌肉刺激、恢复度、训练平衡分析。
* 3D Body 是主界面，不是装饰组件。

技术约束：

* `docs/` 是唯一设计记录点。
* 本地 YAML 是第一版唯一数据源。
* AI 只返回结构化 draft，本地程序负责校验、计算、写文件。
* 3D 模型必须轻量、可按 canonical muscle id 高亮、可在移动端运行。
* 不恢复已移除的 STL demo；运行时只使用当前的离线处理 GLB 资产与数据契约。

---

## 2. 推荐技术栈

### Runtime

MVP 使用本地优先架构：

```txt
React / Vite frontend
  -> local app service
  -> YAML files + deterministic projections

DSH Host Agent
  -> YAML draft + Fitness validate/finalize
```

本地服务可以先用 Node.js 实现，职责是：

* 读取和写入 `fitness-os/` 下的 YAML / Markdown。
* 保护 AI API key，不暴露给浏览器。
* 做 schema validation。
* 做 deterministic stimulus / recovery calculation。
* 把 AI structured draft 转换为最终文件写入。

暂不直接做纯静态浏览器应用，因为浏览器文件系统能力会让写入、监听、权限和 AI key 管理变复杂。

桌面壳选择：

* 第一阶段：Vite dev server + Node local service。
* 第二阶段：再评估 Tauri 或 Electron。
* 默认倾向 Tauri，因为包体更轻；如果 Node 生态和文件能力成为主要复杂度，再考虑 Electron。

### Frontend

使用：

```txt
React
Vite
TypeScript
Three.js
@react-three/fiber
@react-three/drei
zustand
yaml
zod
Vitest
Playwright
```

选择理由：

* React 适合承载 Timeline、Daily Workout、AI Plan、Dashboard 等业务状态。
* React Three Fiber 把 Three.js scene 变成 React 组件，便于把 YAML 数据映射到 3D 材质、高亮和交互。
* drei 提供 `useGLTF`、`OrbitControls`、`Bounds` 等常用 3D UI 能力。
* zod 用于 AI draft、本地 YAML 和 API payload 的运行时校验。
* 纯 Three.js 可以保留在资产验证脚本或低层工具中，但不作为主应用写法。

暂不选择：

* Babylon.js：能力完整，但对当前 React 业务工具偏重。
* Unity WebGL：包体和 Web UI 集成成本过高。
* vtk.js / medical stack：适合医学影像和体绘制，不适合训练肌群热力图。

---

## 3. 应用架构

```txt
UI
  React routes / panels / HUD widgets

3D Body
  R3F Canvas
  MuscleModel
  SkinLayer
  MuscleMaterialController
  MusclePicker

State
  React page state
  selectedDate / selectedMuscle / previewExerciseId
  hoverMuscle (3D local)

Data Provider
  typed API client

Local App Service
  local YAML reader/writer
  schema validation
  deterministic stimulus/recovery calculation
  file watcher

AI Boundary
  LLM structured draft
  local validation
  local computation
  local file write
```

### 3.1 当前前端目录边界

构建与测试配置集中在 `tooling/`（Vite、Vitest、Playwright 及三个 TypeScript 子项目）。根目录 `tsconfig.json` 保留项目引用入口，`eslint.config.js` 保留自动发现入口。统一通过根目录 npm scripts 运行，不要求使用者记忆配置路径。

Vite 以项目根为前端根，保留 `index.html` 和 `design-lab.html` 两个标准 HTML 入口，避免 `src/api/` 模块 URL 与 `/api` 代理冲突；静态资源仍来自根目录 `public/`，环境文件仍从项目根读取，构建输出仍为根目录 `dist/`，服务端输出仍为 `dist-server/`。Playwright 的服务工作目录、测试目录与输出目录均显式配置；URL `/` 与 `/design-lab.html` 保持原行为。

开源源码使用 Apache-2.0，第三方资源见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。截图是本地验收产物，默认写入已忽略的 `test-results/visual-regression/`；公开仓库不保存历史截图附件。

2026-09-14 整理验证：Apache 许可证与官方正文逐字节一致；移除 126 张已跟踪及 6 张未跟踪截图，未动 Git 历史。lint、架构与设计检查、typecheck、完整构建和 50 项单元／组件测试通过。Chromium 全量 23 项 E2E 通过，桌面主站截图已实际检查。集成全量 41/42 通过，凭据恢复保存曾超时；结束其他浏览器任务后，该文件两项独立复验均通过，合计 42 项覆盖通过。未放宽断言或超时，未修改凭据实现，不将复验通过视为已定位偶发超时根因。

```txt
src/
  main.tsx                  # 入口，只挂载应用
  app/                      # 页面编排与跨功能 UI 状态
  api/                      # HTTP、Zod response schema、API 类型
  components/               # 无业务含义的共享展示组件
  features/
    dashboard/              # Dashboard 数据协调
    timeline/               # 训练时间线
    workouts/               # 训练详情与洞察
    muscles/                # 肌肉档案、分组选择、取消与重试
    body-3d/                # Three/R3F 场景、模型绑定与 3D HUD

shared/
  muscle-taxonomy.ts         # canonical muscle id 与显示名称
  fitness/
    schema.ts                # YAML/API schema 与领域类型
    calculation.ts           # 刺激、恢复与训练量纯计算
    projection.ts            # 面向前端的确定性 view model
    training-records.ts      # 统一力量记录组、日期窗口、动作视图 ID
    muscle-history.ts        # 肌肉历史纯查询
    muscle-history-schema.ts # 前后端共用查询/响应 Zod 契约
    muscle-groups.ts         # 首页和文字选择器共用肌群分类
    exercise-labels.ts       # 动作中文显示元数据（不定义关系）

server/
  index.ts                   # 进程入口与环境路径装配
  app.ts                     # 当前 HTTP service composition
  data-store.ts              # YAML 文件边界与原子写入
  automation.ts              # Scheduler、claim、retry 与运行状态
```

依赖方向和文件规模由 `npm run lint:architecture` 检查，详细规则见
`CODING-STANDARDS.md`。

3D 是主界面，但不应阻塞应用壳解析。入口通过动态 `import()` 加载
`features/body-3d`。React 作为稳定 vendor chunk；Three/R3F 保持在单独的异步
chunk 中，不手工设置为 HTML module preload。Three 的核心 ESM 本身较大，生产
构建可以对异步 3D chunk 给出 500 kB 提示，但不得通过提高阈值隐藏，也不得因此
让 3D 重新进入首屏同步依赖。

分阶段：

* 只读原型可以直接从 mock YAML 加载。
* 一旦进入真实写入，必须引入 local app service。
* local app service 负责训练数据读写；计划生成统一由 DSH Agent 完成。

服务端与前端分别构建：`npm run build` 产出 Vite 的 `dist/` 以及 Node 的
`dist-server/`。生产镜像只安装 production dependencies，并以
`node server/index.js` 运行已编译服务；开发模式仍可使用 `tsx watch`。

---

## 4. 前后端数据交流方式

前端不直接写文件。

前端只通过本地 API 表达用户意图：

```txt
GET  /api/muscles/:muscleId?date=YYYY-MM-DD
GET  /api/dashboard
GET  /api/workouts?range=2026-06-01..2026-06-15
GET  /api/plans/today
POST /api/workouts/finish
POST /api/exercises/mastered
```

本地服务内部流程：

```txt
request
  -> validate request schema
  -> deterministic calculation
  -> write YAML / Markdown
  -> return typed response
```

计划生成与修订不再提供专用 HTTP API，也不在 local app service 内组装模型提示词；
DSH Agent 读取工作区上下文并通过既有数据契约创建计划文件。

前端响应只使用 view model，不直接依赖文件路径结构：

```ts
type DashboardViewModel = {
  date: string
  bodyProjection: MuscleVisualState[]
  recentWorkouts: WorkoutSummary[]
  todayPlan?: PlanPreview
  coachInsight?: string
}
```

文件路径仍保存在本地服务层，避免未来从 YAML 迁移到 SQLite / Postgres 时重写 UI。

---

## 5. 3D 资产策略

### 目标

需要一个轻量人体训练模型：

* 有肌肉层。
* 有皮肤层。
* 四肢完整。
* 不要骨骼。
* 不要生殖器。
* 可按肌群高亮。
* Web 端可实时旋转、缩放、点击。

### 当前路线

采用单个静态 Draco GLB，内部保持逻辑双层：

```txt
bodyparts3d-fitness-taxonomy-draco.glb
  -> skin.* nodes
  -> muscle.<muscle_id>.<side> nodes
```

皮肤层：

* 使用与肌肉同坐标系的 BodyParts3D 皮肤外壳。
* 生殖器区域已平滑处理。
* 只作为半透明外轮廓，不承载训练数据。

肌肉层：

* 使用 `body-model-contract.json` 中的 67 个二级 muscle id。
* 每块肌肉使用稳定 node name，并由 manifest/contract 显式映射。
* 计算、API、热力图和点击详情直接使用同一套 67-ID contract。
* 旧 11 个聚合 ID 不再被 schema 或运行时接受。
* 运行时只加载离线处理后的 GLB，不加载原始 STL。

已移除的 STL demo 曾有以下问题：

* BodyParts3D 原始资源约 206MB。
* 原始皮肤 STL `FMA7163.stl` 约 76MB。
* demo 运行时加载多份 STL，首屏和移动端成本过高。
* 后续必须改成离线处理后的 GLB / glTF 资产。

### 肌群粒度

模型层当前包含 67 个健身二级 muscle id、133 个左右/中心 runtime
target。动作映射和确定性计算直接产出 67-ID 分数，避免同一聚合组内
所有子肌肉获得相同刺激值。

左右侧保持独立 mesh；当前计算分数可以左右汇总，后续可扩展单侧训练。

---

## 6. 模型资产来源判断

### BodyParts3D

用途：

* 解剖参考。
* 肌肉几何初始来源。
* canonical muscle id 映射参考。

优点：

* 已按解剖结构分件。
* 当前 demo 已验证可在 Three.js 中加载。

问题：

* 原始 STL 过大。
* 医学结构过细，不适合直接做产品模型。
* 需要确认许可版本并保留署名。

要求：

* 不直接把大量 STL 作为运行时资源。
* 如派生资产，必须保留来源、许可、修改说明。

### Z-Anatomy / OpenAnatomy

用途：

* 研究参考。

问题：

* CC BY-SA 4.0 可能要求派生资产同协议发布。
* 需要逐对象排查是否混入非商用来源。

结论：

* 不作为主生产资产。

### MakeHuman / MPFB

用途：

* 生成皮肤外壳。

优点：

* 核心资产许可更适合应用分发。
* 方便生成中性、完整四肢、无敏感部位的人体外形。

问题：

* 不提供肌肉分层。

结论：

* 推荐作为 `skin.glb` 候选来源。

### MB-Lab

问题：

* 生成资产存在 AGPL 传播风险。

结论：

* 不使用。

### 商业模型

可作为备选，但必须确认：

* 是否允许 Web 分发 GLB。
* 是否允许用户从浏览器缓存中间接获取模型文件。
* 是否允许修改、减面、去除生殖器。
* 是否允许长期商业使用。

---

## 7. 资产处理流程

```txt
source model
  -> Blender import
  -> delete skeleton / organs / reproductive geometry
  -> keep skin + surface muscles only
  -> merge tiny anatomical parts into training muscle groups
  -> rename nodes by canonical muscle id
  -> decimate / retopology
  -> fix normals and origin
  -> export GLB
  -> glTF Transform / gltfpack optimize
  -> validate in browser PoC
```

运行时格式：

* 首选 `.glb`。
* 几何压缩优先验证 Meshopt，再验证 Draco。
* 有贴图时使用 KTX2 / Basis。
* 肌肉颜色尽量用材质色或 vertex color，减少纹理依赖。

性能目标：

```txt
mobile GLB total: < 8MB
desktop GLB total: < 15MB
triangles: < 150k for MVP
draw calls: < 150
interactive FPS: > 45 on modern mobile
first meaningful 3D render: < 2s on local dev
```

---

## 8. 3D 数据映射

所有训练、计划、计算和 3D 高亮都使用 canonical muscle id。

示例：

```yaml
muscles:
  latissimus_dorsi:
    label_zh: 背阔肌
    region: back
    model_targets:
      - muscle.latissimus_dorsi.left
      - muscle.latissimus_dorsi.right

  biceps_long_head:
    label_zh: 肱二头肌长头
    region: arms
    model_targets:
      - muscle.biceps_long_head.left
      - muscle.biceps_long_head.right
```

R3F 运行时状态：

```ts
type MuscleVisualState = {
  muscleId: string
  intensity: number
  recoveryScore?: number
  selected: boolean
  hovered: boolean
  disabled?: boolean
}
```

颜色规则来自 `../product/PRD.md`：

```txt
Gray = 未训练
Blue = 轻刺激
Orange = 正常刺激
Red = 高刺激
Purple = 恢复不足
```

---

## 9. PoC 验证标准

第一轮技术 PoC 只验证 3D 主风险：

1. 加载一个优化后的 `skin.glb` 和 `muscles.glb`。
2. 从 YAML mock 数据读取肌群刺激度。
3. 映射到肌肉颜色、透明度、emissive。
4. 支持 hover、click、multi-select。
5. 支持旋转、缩放、重置视角。
6. 验证桌面和移动端视口不重叠、不空白。
7. 记录 GLB 体积、三角面、draw calls、FPS、加载时间。

通过后再进入应用骨架：

* Timeline。
* Daily Workout View。
* AI Plan Preview。
* Finish Workout 写入 YAML。

---

## 10. 测试策略

MVP 测试重点：

* Schema validation：YAML 和 AI draft 必须被 zod 校验。
* Deterministic calculation：stimulus / recovery 使用 Vitest 单元测试。
* File write flow：plan 生成 workout 的复制逻辑使用集成测试。
* 3D smoke test：Playwright 打开页面，确认 canvas 非空、模型加载完成、hover/click 可触发肌群变化。
* 响应式布局：桌面和移动端截图检查 3D Body、Timeline、Insights 不重叠。

不做：

* 不在 MVP 写复杂医学正确性测试。
* 不用 LLM 输出作为 deterministic test oracle。

---

## 11. 外部资料

* 3D 模型资产调研与候选结论: `../design/body-3d/3D-MODEL-ASSET-RESEARCH.md`
* Three.js GLTFLoader: https://threejs.org/docs/pages/GLTFLoader.html
* Three.js Raycaster: https://threejs.org/docs/pages/Raycaster.html
* React Three Fiber: https://r3f.docs.pmnd.rs/getting-started/introduction
* React Three Fiber Events: https://r3f.docs.pmnd.rs/api/events
* React Three Fiber Performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
* drei useGLTF: https://drei.docs.pmnd.rs/loaders/gltf-use-gltf
* glTF Transform: https://gltf-transform.dev/
* gltfpack / meshoptimizer: https://meshoptimizer.org/gltf/
* BodyParts3D license archive: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
* BodyParts3D Anatomography: https://lifesciencedb.jp/bp3d/?lng=en
* Z-Anatomy GitHub: https://github.com/Z-Anatomy/Models-of-human-anatomy
* MakeHuman license: https://static.makehumancommunity.org/about/license.html
* MB-Lab license: https://mb-lab-docs.readthedocs.io/en/latest/license.html

## 12. 肌肉历史查询边界

新增能力以 [MUSCLE-HISTORY.md](../data/MUSCLE-HISTORY.md) 为数据与交互权威契约。`Dashboard` 拥有业务选择；3D 只接收投影和选中回调；查询 hook 拥有请求取消与错误状态；服务端拥有文件读取和纯函数投影。当前不引入新 store、数据库、Agent 工具或持久缓存。
