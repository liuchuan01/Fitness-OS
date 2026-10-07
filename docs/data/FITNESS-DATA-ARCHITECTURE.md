# Fitness 数据结构与 Agent 写入边界

## 1. 数据事实与职责

YAML 是当前正式训练数据源。DSH 是读取、理解和提出训练决策的 Agent Host，不拥有另一份健身数据库；Fitness service 是 schema、确定性计算、原子写入、变更审计和 Dashboard projection 的权威执行者。

```text
用户 / Scheduler / DSH Agent
  -> fitness/**
  -> Fitness data-store / CLI validate-finalize
  -> Dashboard projection
  -> 3D Body / Timeline / Today Plan
```

```text
fitness/profile.yaml                      长期档案、偏好与约束
AGENTS.md                             Agent 工作区规则与文件写入契约
fitness/programs/*.yaml                      周期目标、容量和 slot 规则
fitness/metrics/body.yaml                    低频身体指标
fitness/metrics/cardio.yaml                  有氧记录
fitness/metrics/nutrition/YYYY-MM-DD.yaml    已确认的每日营养摘要
fitness/plans/YYYY/*.generated.yaml          某日具体训练计划
fitness/workouts/YYYY/*.yaml                 某日实际完成训练
resources/fitness/muscles/*.yaml                       肌肉映射与刺激规则
config/settings.yaml             自动计划配置
runtime/automation/state.yaml             调度游标、claim、retry、last run（不提交）
runtime/automation/runs/                  结构化运行记录（不提交）
```

完整字段语义、样例与周期上下文分别见 [`PROGRAM-DATA-MODEL.md`](PROGRAM-DATA-MODEL.md)、[`Data-AI-Interaction-Design-v0.1.md`](Data-AI-Interaction-Design-v0.1.md) 和 [`../dsh-integration/AGENT-AUTOMATION-TECHNICAL-PLAN.md`](../dsh-integration/AGENT-AUTOMATION-TECHNICAL-PLAN.md)。本文件固定权威性与跨系统写入边界。

## 2. 生命周期不能混写

| 对象 | 含义 | 是否可由 Agent 创建 | 最终权威动作 |
|---|---|---:|---|
| Program | 一个周期的目标与规则 | 可在明确任务下创建 draft | schema 校验；不记录每日完成情况 |
| Plan | 某日拟执行的处方 | 可以创建 draft | `finalize plan` 计算 computed 并原子写入 |
| Workout | 某日真实完成事实 | 只能基于用户报告或明确输入 | `finish-workout` 投影实际值，不推测 RPE/readiness |
| Metrics | 已测量或核对事实 | 可写明确输入 | 保持缺失值为未知，不能补造数据 |
| Automation state | 调度执行状态 | 不属于 Agent 业务写入 | Scheduler 独占 |
| DSH Session | 对话及事件历史 | DSH Host 创建/恢复 | 不复制到 YAML 或 runtime conversation 文件 |

计划不是 workout；模型草案不是正式计划；Agent 进程退出不是业务成功；Scheduler 的 `last_run` 不是某一份训练数据。这些状态必须始终分开。

## 3. DSH 的可写边界

DSH workspace 指向 training 数据工作区。Agent 根据 `AGENTS.md` 读取 profile、program、最近 workout、metrics、肌肉规则和目标日期文件；它可以提出并写入允许的业务 draft，但不能：

- 计算或手写 plan 的 `computed` 结果；
- 绕过 schema/冲突校验直接宣告成功；
- 修改 Scheduler cursor、lease、retry 或 last run；
- 把 Session 消息、模型中间过程或 token 统计写进正式训练数据；
- 在没有用户事实的情况下补造 readiness、RPE、营养或实际完成记录。

可写边界必须对完整文件集合做快照：`fitness/profile.yaml` 与 `fitness/**` 下全部常规文件都纳入审计，不按扩展名猜测。自动计划只允许目标 plan 及其 `.tmp/.bak` 辅助文件发生预期变化；越界变更必须以 `OUT_OF_BOUNDS_CHANGE` 失败并报告 changed files。

## 4. 确定性收口

```text
Agent 语义决策 / draft
  -> validate
  -> finalize plan 或 finish-workout
  -> schema + computed + backup + atomic rename
  -> snapshot audit
  -> Dashboard projection
```

复用统一 CLI / data-store 入口：

```text
npm run fitness -- validate plan <path>
npm run fitness -- finalize plan <runtime-draft.yaml>
npm run fitness -- revise plan <runtime-draft.yaml> <expected-plan-sha256>
npm run fitness -- finish-workout <plan-path> <actual-draft-path>
npm run fitness -- validate all
npm run fitness -- onboarding status
npm run fitness -- draft profile <runtime-draft.yaml>
npm run fitness -- commit profile <confirmed-draft.yaml>
npm run fitness -- update profile <confirmed-draft.yaml> <expected-sha256>
npm run fitness -- commit program <confirmed-program.yaml>
npm run fitness -- commit body <measured-body.yaml>
```

未来食谱、热量或其他 YAML 域也遵循相同模型：先增加正式数据 schema 与 `Agent.md` 指引；只有存在必须由程序保证的计算或状态转换时，再增加 validator/finalizer。不要为了数据类型增长而同步复制一套 MCP 工具 schema。

## 5. 与 DSH Session / UI 的关系

DSH Session event log 只说明对话与执行过程；Fitness projection 只来源于正式文件读取。二者之间只允许一条方向明确的通知：当 Fitness 已验证文件变更并重建 projection 后，向 UI 发出 `fitness.data-changed(revision, changed)`。

UI 收到通知后按 changed scope 刷新 Dashboard、Today Plan 或 Workouts；它不会读取 DSH 消息内容来构建身体状态。这样 Session replay、断线恢复或不同 Device 的历史显示都不会污染训练业务事实。

## 6. 迁移原则

未来从 YAML 迁移至 SQLite/Postgres 时，先保持本文件中对象生命周期、权威写入者和最终校验语义不变；替换的是 data-store 的持久化实现，而不是让 UI 或 DSH Client 直接依赖数据库表。DSH Session persistence 与 fitness domain storage 始终是两套有意分离的存储。

## 7. 肌肉训练档案（第一步）

只读数据流、近 7 日统计口径、单组 `kind` 字段、API 与 UI 状态所有权统一见 [MUSCLE-HISTORY.md](MUSCLE-HISTORY.md)。首页和详情共用力量记录组筛选；历史查询不读取 plan 作为完成事实，不以刺激／恢复分数替代组数。

## 工作区目录与公共资源

WORKSPACE_ROOT 统一推导 fitness/（完整个人 Git 备份单位）、config/settings.yaml（agent/automation/model 普通设置）和 runtime/（会话、调度、建档草稿）。公共肌肉映射与计算规则来自应用 resources/fitness，不复制进个人仓库；manifest 记录规则版本。案例位于 examples/fitness-starter，模板位于 templates/fitness，初始化和读取错误均不回退这些目录。

API Key 只由 DSH 官方凭据机制或启动环境管理，不写入普通 YAML。config 与 runtime 不属于健身 Git。正式审计覆盖 fitness 业务文件，忽略 .git；公共资源和配置的保护是独立边界，目录和提示词不能替代部署权限。

新计划从 runtime 草稿创建，目标已存在则拒绝覆盖；修订计划必须提供原计划原文 SHA256，保存前同时检查档案版本与原计划版本，保留备份。通过应用提交的档案更新和计划／周期发布共用档案锁，避免偏好更新与旧任务提交交错。外部编辑器直接写文件仍需在提交前后由校验和审计发现，不宣称操作系统事务。

### 模型配置兼容边界

配置后台已收敛为 DeepSeek Key；旧 `settings.model` 字段仅保留解析与迁移兼容，不再由 Fitness UI/API 修改，也不覆盖 Host 默认模型。DSH 内置目录与默认路由的事实说明见 [DSH 集成文档](../dsh-integration/DSH-FITNESS-INTEGRATION.md#模型与密钥设置收敛)。凭据仍独立存储，不迁入普通设置。

### 外观主题资源

内置主题位于应用 `resources/themes/`；第三方主题安装到 `<WORKSPACE_ROOT>/themes/`，属于外观扩展资源，不属于 `fitness/` 个人训练库、`config/settings.yaml` 或 `runtime/`。选择偏好仍保存在浏览器。主题包不能修改训练数据、计算规则或肌肉映射，目录发现不触发训练数据刷新。

## 2026-10-07 外部历史记录导入

`fitness import workout <draft-yaml> <source-file>` 接受单日实际 workout 草稿及本地原始文件。允许字段复用 workout schema；computed、source_plan_file、source_import_file 由入口禁止模型提供。CLI 不要求或创建训练计划，不推测 RPE、体重和完成情况，复用公共动作与确定性刺激计算。

原始常规文件按 SHA256 与清理后的文件名原子归档到 `fitness/imports/raw/`，记录通过 source_import_file 引用；同来源可以复用，内容不一致或符号链接越界拒绝。正式 workout 使用既有排他新建与原子链接，目标日期已有记录拒绝覆盖。一天多次训练由 Agent 在确认实际事实后合并为一天的草稿，不隐式覆盖既有日期。单条落盘后运行 validate all；批次不是跨文件事务，需明确报告部分成功与冲突，已成功记录不能重写。归档成功而正式写入失败可能留下未引用的原始文件，保留以便恢复，不宣称整批回滚。

草稿与解析输出位于 runtime/imports 和 runtime/xparse，不能成为第二份正式训练数据库。TextIn 凭据仍由 DSH 官方凭据机制管理；具体开关和云端边界见 DSH 集成文档。
