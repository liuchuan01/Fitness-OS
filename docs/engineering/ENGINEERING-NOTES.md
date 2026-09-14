# AI Fitness OS - Engineering Notes

本文记录实现过程中的工程经验、踩坑和后续迭代需要保留的实践。

## Stage 0: Project Skeleton

日期：2026-06-20

阶段目标：

* 建立不依赖旧 3D demo 的新主应用骨架。
* 前端使用 React / Vite / TypeScript。
* 本地服务使用 Node.js。
* 提供健康检查 API。
* 建立 lint、typecheck、unit test、integration test、e2e 的统一验证命令。

落地结构：

```txt
src/                    # React frontend
server/                 # Node local app service
tests/                  # unit / integration / e2e tests
data/                   # future YAML data root
public/                 # static frontend assets
```

统一验证命令：

```txt
npm run validate
```

该命令当前串行执行：

```txt
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run e2e
```

## Decisions

### 1. 不继承旧 3D demo

新工程入口放在仓库根目录；历史 demo 后续已从仓库移除，不得重新引入其实现或资产。

原因：

* 阶段 0 的目标是不沿用旧 demo 架构。
* 旧 STL demo 和新系统的本地服务、数据模型、3D GLB 策略不一致。

### 2. Health API 先使用 Node 原生 HTTP

阶段 0 只需要一个可验证的 local app service 和 `GET /api/health`。

暂不引入 Express / Fastify，避免在数据读写和 API 面还没展开前增加框架约束。

后续如果 Stage 1 API 增多，可以再评估是否引入轻量路由层。

### 3. Playwright e2e 保留为项目命令

MCP Playwright 可以用于人工 smoke check，但不能替代仓库内的 `npm run e2e`。

原因：

* 阶段验收要求项目自身有自动化 e2e 命令。
* CI 和其他开发者需要能直接执行 `npm run e2e`。
* MCP 浏览器验证不等同于可版本化、可重复执行的测试套件。

## Pitfalls

### npm cache 权限

第一次执行 `npm install` 时，用户级 npm cache 目录存在权限问题：

```txt
EPERM: /Users/liuchuan/.npm/_cacache/tmp
```

处理方式：

```txt
npm install --cache .npm-cache
```

`.npm-cache/` 已在 `.gitignore` 中忽略。

经验：

* 不要为了项目安装直接修改用户全局 npm cache 权限。
* 如果只是当前仓库需要安装依赖，优先使用项目内 cache。

### Playwright browser binary

安装 `@playwright/test` 后，本机未必已有匹配版本的浏览器二进制。

表现：

```txt
Executable doesn't exist at .../chromium_headless_shell-*/chrome-headless-shell
```

处理方式：

```txt
npx playwright install chromium
```

经验：

* 新机器或 Playwright 版本更新后，需要显式安装浏览器。
* e2e 失败时先区分是测试失败还是浏览器运行环境缺失。

### macOS sandbox may block Chromium

在受限 sandbox 中启动 Playwright Chromium 可能失败：

```txt
bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer: Permission denied
```

处理方式：

* 在允许浏览器进程正常启动的权限环境下运行 `npm run e2e`。
* 当前权限放开后，`npm run e2e` 可以正常通过。

### favicon 404 should be cleaned early

第一次 MCP 手动打开页面时，页面功能正常，但控制台出现：

```txt
GET /favicon.ico 404
```

处理方式：

* 添加 `public/favicon.svg`。
* 在 `index.html` 声明 favicon。

经验：

* 这类噪音不影响阶段功能，但会干扰后续 smoke check 的控制台判断。
* 早期保持控制台干净，后续定位真实前端错误更容易。

## Validation Result

Stage 0 最终验证：

```txt
npm run validate
```

结果：

```txt
lint passed
typecheck passed
unit test passed
integration test passed
e2e passed
```

MCP Playwright 手动验证：

* 页面可打开：`http://127.0.0.1:5173/`
* 页面标题：`AI Fitness OS`
* `Workout timeline`、`Body dashboard`、`Training insights` 可见。
* Local service 状态显示 `Healthy`。
* 控制台无 warning / error。

## Follow-up For Stage 1

Stage 1 进入数据模型与本地文件闭环时，建议优先补：

* `server` API 路由结构。
* zod schema 的集中目录。
* YAML parser / writer / atomic write 工具。
* sample `profile`、`plan`、`workout`、`exercise`、`muscle_map`。
* 对错误 YAML 的可读错误响应测试。

## Stage 2: Deterministic Stimulus / Recovery Projection

日期：2026-06-20

阶段目标：

* 用本地确定性计算替代 LLM 直接打分。
* 统一 workout / plan 的肌肉刺激计算口径。
* 给 Dashboard 提供可复用的 projection view model。
* 让前端展示和 `computed` 字段来自同一份计算结果。

落地结构：

```txt
shared/fitness/           # schema、确定性计算和 projection
server/app.ts             # /api/health 和 /api/dashboard
src/api/client.ts         # dashboard API client
src/App.tsx               # dashboard projection rendering
```

实现要点：

* `calculateStimulus()` 按 set 级别聚合，输出 `stimulus` / `recovery_load` / `total_sets` / `total_volume_kg`。
* `calculateRecovery()` 结合最近训练、readiness 和伤病约束，输出 `overall_score` 和 warnings。
* `buildDashboardProjection()` 生成前端可直接消费的 view model。
* 目前使用 sample workout / muscle map 作为阶段 2 验证数据，后续阶段会切到真实 YAML 读写。

当前已完成：

* 计算核已实现并通过单元测试。
* `/api/dashboard` 已返回确定性投影。
* 前端已改为消费 dashboard projection，而不是静态硬编码数值。

当前未完成：

* `data/muscles/muscle_map.yaml` 的完整读写闭环未做，现阶段只有测试 fixture 的 sample map 和运行时 schema。
* `data/muscles/stimulus_rules.yaml` 未接入，刺激 / 恢复公式仍是代码内的 MVP 版本，不是文件驱动规则引擎。
* 用户 readiness 采集流程未实现；Dashboard 不使用 sample readiness 或默认值。
* `computed_expected_stimulus` 还没有写回真实 `plan` 文件。
* `computed.stimulus` 和 `computed.recovery_load` 还没有写回真实 `workout` 文件。
* 计划到 workout 的复制流程、备份、原子写入和错误 YAML 处理仍在后续阶段。
* 当前 `shared/fitness/schema.ts` 里的 schema 只是最小可运行集合，不等于阶段 1 所要求的完整 profile / plan / workout / exercise / muscle_map schema 集中目录。

验证结果：

```txt
npm run typecheck
npm run test
npm run test:integration
npm run e2e
npm run build
```

本次踩坑：

* NodeNext / Node16 模式下，`server/*.ts` 和测试里指向 Node 代码的相对 import 需要显式 `.js` 后缀。
* `vitest.config.ts` 不需要额外挂 React 插件，保留 `vitest/config` 的 `defineConfig()` 更稳。
* 恢复评分如果直接按总刺激求和，样例数据容易被打到 0，需要用更粗粒度的平均负荷做归一化。

## Stage 2 Completion Pass: File-backed Deterministic Computation

日期：2026-06-20

本次补齐阶段 2 的文件闭环，不涉及 3D Body PoC。

落地结构：

```txt
data/muscles/muscle_map.yaml         # 动作到肌群映射
data/muscles/stimulus_rules.yaml     # MVP 计算参数
data/workouts/2026/*.yaml            # 真实训练样例
data/plans/2026/*.generated.yaml     # generated plan 样例
server/data-store.ts                 # YAML 读取、schema 校验、computed 写回
server/app.ts                        # /api/dashboard 接入真实 data/
shared/fitness/calculation.ts        # 计算核支持 stimulus rules
```

实现要点：

* `/api/dashboard` 不再直接返回内存 sample，而是读取 `data/` 下的 YAML。
* 本地程序读取 `muscle_map.yaml` 和 `stimulus_rules.yaml` 后计算训练量、肌肉刺激和 recovery load。
* 当前最新 workout 会写回 `computed.total_sets`、`computed.total_volume_kg`、`computed.stimulus`、`computed.recovery_load`。
* 当前最新 generated plan 会写回 `computed_expected_stimulus`。
* 写入使用临时文件 rename 的原子替换；覆盖前生成 `.bak`，并通过 `.gitignore` 排除备份。
* 为避免 dashboard 刷新制造备份，只有 computed 字段与当前计算结果不一致时才写回。

验证结果：

```txt
npm run validate
```

结果：

```txt
lint passed
typecheck passed
unit test passed: 6 tests
integration test passed: 2 tests
e2e passed: 1 test
```

当前边界：

* 仍未实现完整阶段 1 的 plan 到 workout 完成闭环和 profile/exercise/library schema 集中目录。
* `stimulus_rules.yaml` 已接入 MVP 参数，但不是完整规则 DSL。
* `/api/dashboard` 的写回行为适合当前本地 PoC；后续如果需要纯查询 API，应拆出显式 recalculation endpoint。
## 2026-06-28 前端架构与 3D chunk 重构

问题：

* `App.tsx` 同时承担请求、页面状态、时间线、训练详情和格式化逻辑。
* `BodyViewer3D.tsx` 同时承担产品 HUD、资产元数据、R3F 场景和材质绑定。
* 入口同步导入 Three/R3F，生产 JS 单 chunk 为 1,117.68 kB（gzip 307.71 kB）。
* 原 `typecheck` 使用 `tsc --noEmit` 执行 solution tsconfig，未真正检查 project
  references；生产构建能发现而 typecheck 漏报。

处理：

* 按 `app / api / components / features` 建立前端依赖边界。
* API 拆分为统一 HTTP 传输、Zod response schema 和业务方法。
* Dashboard 请求集中到 feature hook，并用 `AbortController` 防止卸载更新和旧请求
  覆盖新日期。
* 3D 产品层与场景层拆开，整个 3D feature 使用 React lazy 动态加载。
* 增加 `lint:architecture`，自动检查跨层导入、Three 使用范围和文件行数。
* `typecheck` 改为 `tsc -b --pretty false`，正确检查两个 TS project。

结果：

* 首屏业务入口 73.64 kB（gzip 19.51 kB）。
* 首屏 React vendor 142.95 kB（gzip 45.76 kB）。
* 3D 异步 chunk 898.12 kB（gzip 242.28 kB），不出现在 HTML module preload 中。
* 3D 异步 chunk 仍超过 Vite 默认 500 kB 提示。Three 核心是大型单 ESM 模块；曾验证
  强制手工拆 Three/R3F 会使 Vite 把 3D 依赖写入首屏 module preload，因此不采用。
  后续优化应评估替换 Drei 能力、Three 定制构建或 worker/资产加载策略，而不是隐藏提示。
