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

* 读取和写入独立工作区 `fitness/` 下的 YAML / Markdown；资源、配置和 runtime 按数据架构分离。
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

Vite 以项目根为前端根，仅保留 `index.html` 标准 HTML 入口，避免 `src/api/` 模块 URL 与 `/api` 代理冲突；静态资源仍来自根目录 `public/`，环境文件仍从项目根读取，构建输出仍为根目录 `dist/`，服务端输出仍为 `dist-server/`。Playwright 的服务工作目录、测试目录与输出目录均显式配置；主站 URL `/` 保持原行为；独立设计实验页已于 2026-09-30 按用户要求移除。

开源源码使用 Apache-2.0，第三方资源见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。截图是本地验收产物，默认写入已忽略的 `test-results/visual-regression/`；公开仓库不保存历史截图附件。

2026-09-14 整理验证：Apache 许可证与官方正文逐字节一致；移除 126 张已跟踪及 6 张未跟踪截图，未动 Git 历史。lint、架构与设计检查、typecheck、完整构建和 50 项单元／组件测试通过。Chromium 全量 23 项 E2E 通过，桌面主站截图已实际检查。集成全量 41/42 通过，凭据恢复保存曾超时；结束其他浏览器任务后，该文件两项独立复验均通过，合计 42 项覆盖通过。未放宽断言或超时，未修改凭据实现，不将复验通过视为已定位偶发超时根因。

```txt
src/
  main.tsx                  # 入口，只挂载应用
  app/                      # 页面编排与跨功能 UI 状态
  api/                      # HTTP、Zod response schema、API 类型
  components/               # 无业务含义的共享展示组件
  features/
    settings/               # 设置工作区：外观、教练、自动计划、模型连接
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
  app.ts                     # 服务装配、生命周期与业务路由
  http/                      # JSON 协议处理与静态文件响应，无业务依赖
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
* 当前正式 GLB 已用于 Three.js 运行时。

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

颜色规则以 `docs/design/DESIGN.md` 第 7.3／7.4 节及共享主题 token 为准：Neon 使用青至洋红柔和桥接，Graphite 使用冷灰蓝至暖沙色连续色带；零负荷与缺失为灰色，动作与焦点使用独立语义。领域离散 status 不能替代人体连续取色。

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

## 13. 2026-09-30 清理与结构评估

本轮属于“无用代码清理与模块边界审查”。删除设计实验入口、主题／渐变提案、专用 BodyStylePreview、旧 3d-muscles/viewer.html 和两份 demo E2E；正式 theme、color-scale、人体渲染与主题测试继续保留。移除没有调用方的前端 getHealth／getPlan 封装及 health response schema，服务端健康检查和按日期读取计划接口仍有部署／集成用途。移除 demo 遗留的 neonScales、未使用的 defaultSchedule 副本和五个孤立类型；有效调度默认值仍由 agent-settings 持有。移除直接依赖 zustand；R3F／Drei 仍间接依赖它，因此 lockfile 中出现 zustand 不代表清理失败。

### 结论与边界

生产 TS／TSX 相对导入扫描覆盖 91 个模块、200 条边（包含类型导入），未发现循环。此扫描不涵盖包内部依赖或计算得到的动态路径，不能替代完整依赖门禁。

当前适合继续使用一个 Node 服务加按功能组织的前端。`src`、`server`、`shared`、`dsh-fitness`、`resources` 和工作区数据已经承担不同职责，不需要为目录整齐引入 monorepo、多服务、DI 容器或通用 repository 框架。仓库内的两个 DSH 包是 Host 加载边界，不能按“独立页面不用了”删除。`tests/fixtures` 的示例和 adapter、迁移 CLI、3D 资产生成与验证脚本都有测试或维护用途，不属于废弃 demo。

| 模块 | 现状与判断 | 拆分方向 |
| --- | --- | --- |
| `src/app`、`src/features` | 页面编排与业务功能基本分开；无 feature 反向引用 app | 保留当前纵向组织，避免为文件行数拆展示碎片 |
| `src/features/settings` | 已按后续授权收拢设置工作区；原 automation 目录移除 | 页面编排与四个设置分区分离，详见第 14 节 |
| `server/app.ts` | 已把 HTTP JSON 和静态文件处理抽到 `server/http`；仍集中业务路由及实例生命周期 | 后续按 fitness、automation、DSH/settings 分路由，以显式依赖注入处理函数；app 保留装配、启动和关闭 |
| `server/data-store.ts` | 605 行，混合计划终结、workout 写入、查询投影与文件操作 | 优先分离查询和写入用例；原子覆盖、新建排他写入、备份与路径审计必须保持不同语义，不能盲目合并为一个 writeYaml |
| `server/automation.ts` | 567 行，状态机、时区计算、执行前检查、文件审计集中 | 优先提取纯 occurrence／时区计算，其次文件审计；claim、lease、retry、串行队列仍由同一 Scheduler 持有 |
| `server/onboarding.ts` | 415 行，建档流程与 revision／路径／锁保护共存 | 随写入用例拆分提取保护原语，保留 profile revision 的一致性边界 |
| `shared/fitness` | schema、纯计算、投影、肌肉历史已分离 | 保留；设置／调度 schema 存在多处定义，统一前需核对 strict、输入默认值与响应投影差异 |
| 架构门禁 | 已检查 TSX 规模与部分 import 方向，但未完整检查 shared 纯度、循环依赖、动态 import 或未使用导出 | 现有 lint 通过仅证明所覆盖规则；后续增加解析器驱动的依赖检查时纳入这些边界 |

清理阶段只实施可独立回归的 HTTP 提取；设置边界随后按用户授权实施，见第 14 节，其余拆分仍是建议。业务写入、调度成功判定、DSH Session 和生产部署行为保持原契约。验证结果见本节后续记录。

### 本轮验证记录

- lint、architecture lint、design lint、typecheck、58 项单元／组件测试、完整生产 build 与三项 3D 资产校验通过；最终构建仅含 `dist/index.html`。删除孤立导出后重新执行了静态检查、58 项测试和构建；自动化／HTTP 17 项集成复验通过。
- 全量 45 项集成测试通过，包含真实已安装 DSH Host 的本地 adapter 和临时空工作区凭据流程；不代表真实模型调用或生产部署。
- 默认 E2E 端口 8788 被已有服务占用，改用临时配置的 8797／5197。首批完成 19 项，其中 17 项通过，手机探索超时与 3D 零像素两项失败；保持断言及超时，单 worker 独立复验两项均通过。随后补跑的 Neon 遮挡验证通过。合计覆盖 20 项通过，不宣称一次性全量通过或已定位偶发失败根因。
- 后续检测到其他工作正在修改聚焦、HUD 与肌肉档案文件；Graphite 遮挡用例等待原相关动作入口时主动中断，余下 15 项未运行。停止在持续变化的工作树上扩大验收，保留并行改动。上述构建／审图仅代表运行时点的内容，不能代替并行 UI 修改后的最终整体验收。
- 固定夹具／日期的桌面和手机实际审图见 `docs/design/VISUAL-REVIEW.md`。Three 异步 chunk 大于 500 kB、单元测试的多 Three 实例提示仍存在；未调整告警阈值。

## 14. 设置功能边界

按用户授权，将原 `src/features/automation` 中的完整设置工作区收拢到 `src/features/settings`。应用仅通过 `SettingsPage` 进入设置，`#/settings` 与 `#/settings?section=connection` 路由保持原行为。

```text
src/features/settings/
  SettingsPage.tsx           # 导航、页面草稿、教练／调度请求与保存反馈
  SettingsCard.tsx           # 设置功能私有的共享展示卡片
  settings.css              # 设置工作区及表单样式
  appearance/               # 主题选择和布局示意
  coach/CoachSettings.tsx    # 教练指令受控表单
  automation/AutomationSettings.tsx  # 自动计划受控表单、运行状态和操作
  connection/               # 密钥、模型偏好、DSH 标识、hook 及其测试
```

`SettingsPage` 拥有教练与自动计划的草稿、已保存值和异步动作；两个分区组件接收值与回调，不发请求。密钥和模型偏好继续由 connection 内组件／hook 独立管理。分区容器保留挂载，通过 hidden 切换，防止切换时丢失未保存输入。四类设置保持独立保存，服务端调度、Host 生命周期和 API 契约不变。

外观选择仅被设置使用，因此随设置收拢；应用级 ThemeProvider、主题定义与 token 仍位于 `src/design`。`SettingsCard` 仍为功能私有，底层材质依赖共享 GlassCard。保留现有 CSS 类名与视觉参数，避免纯目录调整扩散为视觉重构。设计门禁路径与 DSH 标识来源文档同步更新，不留旧路径转发模块。

本轮验证：lint、lint:architecture、lint:design、typecheck、58 项单元／组件与完整 build 通过；隔离端口运行 `appearance.spec.ts` 的 6 项 E2E 全通过，覆盖两主题、1440／390／320px 四分区、路由、草稿保留、教练／调度独立保存与模型设置。实际审图见 VISUAL-REVIEW。本轮未改后端，不重复声称完成真实模型调用或生产部署；工作区并行的人体／HUD 改动不纳入设置提交。


## 15. 声明式主题包

主题协议位于 `shared/themes`，内置包位于 `resources/themes`，用户安装目录为 `<WORKSPACE_ROOT>/themes/<id>/theme.json`。主题不属于 `fitness/` 训练数据，也不参与训练 schema、计算或 Scheduler 审计。服务端主题模块在读取目录时校验配置与资源并返回目录及诊断；前端通过 `src/api` 获取，注册表不依赖固定主题 ID。页面刷新即可发现新增包，无需重启服务或重新构建。

`src/design` 把已校验主题转换为同源 CSS 变量与人体材质参数。内置包是离线回退，生成的 `tokens.css` 仅承载启动默认值；运行时应用同一适配结果。字体和预览为声明式包内资源，不执行第三方 JavaScript 或 CSS。包内资源走专用资源路由，不能沿用缺文件回退 `index.html` 的 SPA 路由行为。

外观偏好仍为浏览器级状态，与教练／调度草稿及 DSH 会话独立。主题变化不重建业务页面状态。目录读取失败时不得把不可用误判为卸载并覆盖用户偏好；目录完整且所选包确定不存在时回退内置主题。资源准备失败有降级与诊断，切换使用同一个已解析快照。

生产镜像已有 `resources/` 复制和完整工作区挂载，内置包随镜像发布，安装包随工作区保留。主题目录不是构建产物，不写入 `dist/`。作者指南、模板、版本及资源限制见 `docs/design/THEME-PACK-AUTHORING.md`。Agent Surface 维持独立主题边界，本增量不声明真实 Host 已同步换肤。

本增量验证：lint、lint:design、lint:architecture、typecheck、65 项单元／组件、52 项集成、完整 build、3D contract／source-map／runtime 校验通过。7 个相关 E2E 文件共 27 个唯一用例通过，覆盖生产构建后目录安装与卸载、资源、跨标签同步和业务状态保留。三主题两视口四模式已实际审图，详细范围、一次截图准备失败及复验记录见 VISUAL-REVIEW；未进行生产部署或 Agent Host 主题同步验收。

### 15.1 亮色主题与读取／切换边界修复（2026-10-05）

新增 Orbital 内置亮色包，默认 Neon 不变。共享保留 ID 列表位于 `shared/themes/builtins.ts`，前端内置回退与服务端禁止覆盖使用同一组 ID。协议 v1 兼容增加 light 与可选照明色，暗色包的照明默认行为不变；亮色默认取 raised，Orbital 显式使用白光。

主题文件读取先校验路径组件及最终普通文件类型，再以 NOFOLLOW／NONBLOCK 打开并复查 fstat，避免 FIFO 在类型检查前阻塞线程池。资源不合规则隔离诊断；合法包仍可回退。字体预载期间单选项跟随 pending ID，重新选择当前主题能取消旧请求，并由原 sequence 防止迟到结果覆盖。

本轮验证：静态检查、66 项单元／组件、完整 build、三项 3D 资源检查与主题 CLI 通过。全量集成初次 53/54，凭据恢复保存超时的文件两项独立复验通过，合计覆盖 54 项，不宣称已定位偶发根因。10 项相关 E2E 通过，覆盖三主题设置、人体材质／图例与生产目录包生命周期。最终文字对比度调整后重新通过 design lint 和 build，实际审图范围见 VISUAL-REVIEW。未进行生产部署或 Agent iframe 主题同步验证。

## 16. 可选文件解析与历史迁移（2026-10-07）

设置模块增加 xparse 分区，首次进入才读取其配置与凭据，切换分区保留草稿。共享协议位于 shared/xparse.ts；普通开关复用 application settings 的分节锁和原子写入；凭据沿用 Fitness 同源 API → 认证 loopback bridge → DSH credentialsController，不建立平行凭据库。页面、设置写入和云端解析的成功状态分开。 文件解析表单按本地开关草稿渐进展开：启用前禁用付费开关，关闭启用时同时将付费草稿设为 false；凭据区域仅在 enabled 与 allowPaid 均为 true 时挂载，凭据输入由原 hook 持有，收起不清空。保留显式保存和现有 API/Host 边界，页面收起不删除已存凭据，也不表示运行中配置已变更。

原生技能及受控 CLI runner 位于 dsh-fitness/automation-bridge；CLI 是锁定版本的 production dependency，Docker 现有 node_modules 与 dsh-fitness 拷贝路径覆盖其平台包、Skill 及引用文件。目录注册、取消和凭据读取均属 Host，Fitness service 不持有会话消息副本。第三方 CLI 执行采用参数数组、超时/取消、输出上限与固定输出目录，密钥不进入 argv 或模型参数。

历史 workout 新入口复用 data-store 的计算输入、路径检查与排他写入。未调整训练 schema 或计算公式。单条导入是提交单位，来源归档可先于正式记录提交，跨日期批次不保证事务。能力与安全边界详见 DSH 集成文档“可选 TextIn 文件解析”。
