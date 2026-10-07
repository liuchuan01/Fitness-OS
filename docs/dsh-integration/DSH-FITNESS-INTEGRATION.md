# DSH 与 AI Fitness OS 集成架构

## 1. 结论与边界

DSH 是长期运行的 Agent Host，不是一次 Fitness 请求临时拉起、会话结束即销毁的进程。Fitness 应用拥有训练业务、持久调度、YAML 数据校验与身体投影；DSH 拥有 Session、历史、流式事件、Agent 队列、工具调用、审批和浏览器会话恢复。

```text
Fitness service                         DSH Host（长期运行）
  Scheduler / YAML validation              Web Client / Session history
  Dashboard projection                     Agent / queue / tool / approval
  typed business outcome                   event log / reconnect
          |                                           ^
          | loopback authenticated bridge             |
          +---- automatic Session --------------------+

Fitness Web ---- central Agent Surface ----> DSH Web Client
```

一个 Session 是一段可恢复的对话或一次自动任务，不等于 DSH Host 的进程生命周期。交互 Session 和自动 Session 可以共享同一个 Host 与 Session 持久化，但不能共享业务含义：前者由用户控制，后者由 Scheduler 以日期幂等键控制。

本设计保留 `AGENTS.md + YAML + deterministic CLI/data-store` 的业务边界；本阶段不因 UI 改造引入 fitness MCP。既有自动化实现与数据校验细节见 [`AGENT-AUTOMATION-TECHNICAL-PLAN.md`](AGENT-AUTOMATION-TECHNICAL-PLAN.md)。

## 2. 当前实现与本地边界

当前实现直接依赖 `@deepseek-ai/dsh@0.1.5-rc.2`，并由 Fitness service 以 `dsh --profile fitness` 启动一个长期运行的 DSH Host。每次启动会在 `$DSH_HOME/profiles/fitness` 物化一个只引用仓库内 `dsh-fitness/` 的 profile：`dsh-fitness-surface` 取代默认 layout，`fitness-automation-bridge` 挂到同一 Host 的 loopback HTTP 路由。

```text
interactive: Fitness iframe -> DSH fitness profile -> Session Controller
automation:  Scheduler -> authenticated loopback bridge -> 同一 Session Controller
```

因此自动任务不再经 SDK 再启动独立的 `dsh --profile sdk` runtime。Scheduler 的 `AgentRuntime` 只负责 bridge admission 和 Host 的 `running/idle` 观察；训练文件校验、幂等 claim、重试与最终 business outcome 仍留在 Fitness。

本次交付以本机、单用户开发为边界：bridge secret 仅供同 Host loopback 使用，`runtime/dsh` 内的 Host/profile 状态可在崩溃后通过新会话恢复。生产环境的独立 Agent 子域、反向代理 cookie/WebSocket/trusted-host 配置，以及多写者并发保障明确留作后续发布 POC，不能直接把当前 `:3080` 暴露到公网。

## 3. 目标主链路

```text
用户打开 Agent Surface
  -> DSH Fitness Web Surface
  -> 官方 Session Controller / Conversation projection
  -> Agent 读写 workspace
  -> Fitness deterministic validate/finalize
  -> Fitness data projection 更新 3D Body

Scheduler claim occurrence
  -> fitness-automation-bridge
  -> 同一 DSH Host 创建或恢复 fitness-daily-YYYY-MM-DD
  -> 官方 Session queue
  -> Agent 读写 workspace
  -> Fitness Scheduler 判定 typed business outcome
```

DSH 是唯一会话事实源。Fitness 不新增 conversations/messages/events REST API，不保存消息副本，也不从 Assistant 文本推断训练业务成功。

Fitness 是唯一训练业务事实源：`fitness/profile.yaml`、`fitness/**` 与 `runtime/automation/**` 分别保存档案、正式训练数据和调度状态。Agent 成功退出不代表计划生成成功；仍必须经过文件边界审计、schema 校验和确定性计算。

## 4. Fitness DSH Surface

默认 DSH Web 是可组合的 Cordis Client Modules 图。目标不是 fork DSH，也不是在 iframe 上覆盖脆弱 CSS，而是增加私有 profile bundle：

```text
保留
  connection / api remotes / session controller / workspace controller
  ui-session / ui-conversation / ui-chat / ui-tool / ui-approval
  input trigger / commands / attachment / reconnect

替换或不呈现
  ui-layout          -> ui-fitness-surface
  ui-sidebar         -> 按需打开的 fitness session drawer
  ui-brand-official  -> 禁用
  settings 页面入口  -> 不呈现
```

`ui-fitness-surface` 注册新的 root layout，中央继续渲染官方 `main` keyed slot 的 `conversation` occupant；因此不复制消息投影、Markdown、工具卡片、审批或断线恢复。它提供新版 `ctx.layout` 导航接口、root `panelInfo` hook 与 `rightbar` slot，供官方 Chat 的文件与工具预览打开及关闭；旧 details slot 已移除。右侧预览在 iframe 中按需覆盖，不挤压主站人体与侧栏。底层 `ui-settings` service 不能一并关闭，因为 Conversation 和 Theme 仍依赖它；只移除其日常可见页面。Fitness profile 禁用 Session 日志导出入口，避免把不常用的调试/导出操作带入训练界面。

会话管理采用 Fitness 风格的按需抽屉：创建、恢复、切换、搜索、重命名与归档仍经官方 Workspace / Session controller 完成，不重建第二套会话列表。

## 5. 自动任务接入同一 Host

在 DSH Host 中新增 `fitness-automation-bridge` plugin。Fitness Scheduler 仍拥有 occurrence、claim、lease、retry、运行历史与最终业务 outcome；bridge 只负责把已 claim 的任务安全地送入同一个 DSH Host：

```text
POST loopback bridge (HMAC or independent shared secret)
  -> create/adopt sessionId = fitness-daily-YYYY-MM-DD
  -> prompt(sessionId, mode: queue, requestId)
  -> return admission result
```

bridge 不能复用浏览器 token/cookie，也不能把 DSH browser Remote 当作 Node automation API。它需要按 `(sessionId, runId)` 去重；`queue` 仅表示目标 Agent inbox 排队，不替代 Fitness 的全局写入并发策略。

completion 的业务语义仍在 Fitness：bridge 提供 Session 的运行/空闲观察，Fitness 在每次可能完成后重新检查 `fitness/**`、执行 validate/finalize 和变更审计。Host 重启后，进程内 control snapshot 不可视为持久成功证据，Scheduler 应以既有 state 与目标文件重新对账。

## 6. Web 发布边界

不能将默认 DSH Web 简单反代至 `https://fitness.example.com/agent/`。DSH Remote Gateway 使用根路径 `/api` 与 `/api/remote.mux`，会和 Fitness 的 `/api` 冲突，且浏览器 cookie、WebSocket 与 Host/Origin 校验都属于 DSH Host。

推荐拓扑：

```text
https://fitness.example.com         Fitness Web + Fitness API
https://agent.fitness.example.com   DSH Fitness Web Surface + DSH Remote Gateway
```

主页面只把 `agent.fitness.example.com` 放入中央 Agent Surface；用户不需要进入独立 DSH 产品页面。本地开发可使用独立端口。生产部署必须验证 token handoff、HttpOnly cookie、WebSocket、刷新后的 Session 恢复和 `trusted-host`；仅暴露容器内 `127.0.0.1:3080` URL 不是有效部署。

## 7. Fitness 事件桥

Fitness 不消费或复制完整 DSH event log，只接收用于更新自己的最小业务投影：

```ts
type FitnessAgentBridgeEvent =
  | {
      v: 1;
      type: "fitness.agent.run-state";
      sessionId: string;
      source: "interactive" | "automation";
      state: "idle" | "running" | "awaiting-approval" | "succeeded" | "failed";
      runId?: string;
      at: string;
    }
  | {
      v: 1;
      type: "fitness.data-changed";
      sessionId: string;
      changed: ("dashboard" | "today-plan" | "workouts")[];
      revision: string;
      at: string;
    };
```

`run-state` 只表示界面运行态，不能代表业务成功。`data-changed` 只能在 Fitness 服务确认允许文件已稳定、重新建立 projection 并通过确定性校验后产生；不得由 iframe `load`、Assistant 文本结束或任意 Tool call 触发。

若 DSH Surface 与 Fitness 保持不同 browser origin，使用 `postMessage`：发送端必须固定 `targetOrigin`，接收端必须校验 `origin`、`source` 与 v1 schema，禁止使用 `'*'`。若未来证明能在同一 client runtime 内组合，则保留该事件契约，改由类型化内存 bridge 传递。

### 本地共享文件同步

Fitness Web 订阅同源 `GET /api/data-events` SSE；服务对 `fitness/` 下的目录分别使用 `fs.watch`，避免原子替换后继续监听旧文件 inode，
等待 350ms 写入稳定后按文件内容计算 revision。计划和 workout 通过既有
`validateFitnessData` 校验、Dashboard projection 构建成功，且前后 revision 一致，
才发出 `fitness.data-changed`。当前保守地刷新 dashboard、today-plan 和 workouts 三个范围，
包括正在查看的训练详情和计划。备份与临时文件不参与 revision。

文件事件没有可靠的 Session 归属，故此同源契约不伪造 `sessionId`，也不走 iframe。
语法错误、尚未 finalize 的计划或计算字段不一致时发出 `fitness.data-invalid`，前端保留
已经显示的数据并提示待校验；修复后自动恢复。SSE 重连会重新检查最新文件，不依赖消息历史。
该校验包含档案、周期、本轮指标以及计划/workout schema；不推断未定义的指标领域。

`fitness.agent.run-state` 仅更新运行提示，收起对话与 Agent 变为空闲均不触发数据刷新。
Web Dashboard/计划读取使用 `readOnly` 模式，不再借页面读取回写 computed 或修复草稿；
未 finalize 的计划读取返回 422。显式 CLI finalize 和 workout 写入接口继续拥有落盘职责。
这仍是单机单用户边界：内容哈希与写入稳定检查不替代跨进程文件锁或多写者事务。

## 8. Surface 视觉与交互

Surface 是 [`../../design/DESIGN.md`](../../design/DESIGN.md) 的 Agent 专项实现：展开时只覆盖中央 Body Canvas，Time Rail 与 Training Rhythm 保持原位，3D Body 作为低亮度背景持续渲染。关闭时只保留中央底部的低高度 launcher。

- 不显示 DSH logo、默认 workspace tree、通用设置页、双栏聊天壳、模型调试信息或内部工具细节；只在右下角保留弱化的 `Powered by DSH` 文本。
- “历史对话”“新会话”和“收起”通过官方 `conversation.session.header.utilities` 插槽进入会话标题同一行，不另起顶栏，也不悬浮覆盖标题操作；空白会话没有标题栏时才显示独立入口。新会话调用官方 `uiWorkspace.startSession()`，会话与工作区仍复用官方 Session/Workspace controller，不另建会话库。
- Agent 回复用“建议、理由、下一步、结果”的排版层级；保留官方 Markdown、Tool、Approval 行为，不使用彩色左右气泡。
- 使用深黑蓝透明背景、克制 blur、冰蓝状态色 `#7dd3fc` / `#38bdf8`、Inter/Space Grotesk 与 JetBrains Mono；避免霓虹、扫描线和厚描边。
- 对话过程中不操作人体，不增加旋转模式。保留之前的 3D Body 和 HUD，适度降低 HUD 亮度、使用轻微模糊，维持身处同一个应用画布的连续感；对话层接收指针。
- 小屏从底部拉起，最高约 `75dvh`；尊重 `prefers-reduced-motion`，收起后焦点回到 launcher。

### Surface 加载生命周期

首次打开时，Fitness 显示自己的深色加载层，iframe 保持隐藏。自定义 Surface
通过限定目标 origin 的 `fitness.surface.connect` / `fitness.surface.ready` 握手连接。
Surface 只接收来自 `window.parent` 的 connect，回复固定到该消息的 HTTP(S) origin，
不依赖认证跳转后可能为空的 `document.referrer`。挂载主题且官方 Session 列表进入 `ready` 后，向父页面发送
`{ v: 1, type: "fitness.surface.ready" }`；父页面同时验证 origin 和 iframe source
后展示页面。该信号只表示界面就绪，不表示 Agent 执行成功，也不触发数据刷新。
就绪通知不依赖 `requestAnimationFrame`，因为浏览器可能暂停隐藏 iframe 的动画帧。
30 秒未收到通知时显示连接超时与重试入口。

首次恢复时保留 DSH 已选中的非空 Session；如果官方初始选择为空白 Session，则打开
配置的 Fitness 交互 Session，避免空白默认选择遮住已有历史。

收起仅隐藏 iframe，保留连接、会话和输入草稿；再次展开复用原页面，并在收起后将
焦点交回 launcher。外层 HUD 的隐藏样式仅在 Surface 展开时生效。

训练 Agent 的额外教练指令保存在 `config/settings.yaml`，与自动计划一起从应用的
“Agent 设置”页编辑。DSH Host 插件通过 `systemPrompt.section()` 在每次请求组装时读取该文件，
因此保存后的指令从下一条消息起生效，不需要重启 Host。DSH 自身的基础运行提示仍由官方组件维护。

## 9. 推进顺序

### 历史对话轮盘

历史入口按需在右侧 Context Panel 上覆盖毛玻璃层，关闭后恢复原身体状态内容；这是中央对话覆盖范围之外的显式导航例外。手机采用右侧抽屉，不挤压对话布局。

Surface 订阅官方 `sessions.list`，仅投影非空、非子 Agent 会话的 ID、标题、更新时间和运行标记。包含同 Host 的自动任务历史，按更新时间倒序；不读取或复制消息正文。点击记录调用官方 `sessions.open(id)`，成功后关闭轮盘；失效记录与刷新失败保留可恢复错误。

新增 `fitness.history.state` 与 `fitness.history.close/refresh/select` 为纯 UI 导航消息。父页面校验 iframe origin/source 与 Zod schema，Surface 校验 parent origin/source 及 Session 是否仍在官方列表。它们不触发训练数据刷新，不表示业务成功。列表只在展开时传给父页面，不持久化。

轮盘中间向左靠近对话，上下向右外退；原生滚动支持鼠标和触控，记录显示标题与本地更新时间，不显示搜索框。轨道与圆点共用同一抛物线坐标，按实际视口尺寸计算；圆点固定在记录中心，不缩放，不使用滚动吸附，滚动时同步更新横向位置。支持方向键、Home/End、Escape、焦点回到历史入口以及 reduced-motion；展开期间右侧原面板不可交互。

本地验证：使用真实 Surface 模块与隔离 Session 服务夹具验证十条历史的切换、桌面/手机覆盖、标题行入口与焦点恢复；测量多个滚动位置的圆点中心与轨道偏差小于 0.8px。隔离真实 DSH Host 验证元数据桥、空列表与关闭行为，不发起模型请求。测试入口为 `tests/e2e/session-history.spec.ts`，不将测试对话写入正式 Session 库。

标题栏合并使用已有会话的隔离副本在真实 DSH Host 验证：1440px / 390px 下三个入口均位于官方标题行，没有额外按钮栏或页面横向溢出，未调用模型。

1. **Surface POC**：自定义 DSH client shell plugin + 后置 profile bundle，替换默认 root layout，同时证明官方 Session、history、Tool、Approval、details 与 reconnect 都保留。
2. **Host bridge POC**：DSH Host plugin 接收 Scheduler 的本机认证请求，在同一个 Host 创建/恢复 `fitness-daily-*` Session；Fitness 继续拥有 claim、retry 与业务 outcome。
3. **发布 POC**：验证 `fitness.example.com` 与 `agent.fitness.example.com`（或等价受控 origin）的 token/cookie、WebSocket、trusted-host 与 reconnect；不采用 `/agent/` path-prefix 反代。
4. **统一接入**：在前三项有证据后，移除 SDK 自动 runtime 与默认 DSH 页面入口，收敛为一个 DSH Host。
5. **事件桥与视觉回归**：只接入 `fitness.agent.run-state` 和验证后的 `fitness.data-changed`；覆盖桌面、窄屏、历史、流式、审批、自动任务与 reduced-motion 截图。

## 10. POC 验收

1. 自定义 bundle 后无 DSH 品牌、默认工作区树和默认设置入口，但 Session、历史、工具、Approval、刷新恢复均正常。
2. Host bridge 可创建/恢复 `fitness-daily-*`，自动任务在同一 Host 的 history 中可见。
3. Host 重启后 Scheduler 能从持久 state 与文件状态恢复，不重复写计划。
4. agent 子域或等价部署拓扑能完成 cookie、WebSocket 和 reconnect。

### 已完成的本地验证

- alpha.3 Host 成功加载 `@ai-fitness-os/dsh-fitness-surface/client.js`；无默认 DSH 品牌，浏览器中自定义 `fitness-surface` 正常渲染且无 client error。
- 项目级 [`../../dsh-fitness/config.json`](../../dsh-fitness/config.json) 声明工作区路径、标题和交互 Session ID；Host 启动时创建或复用工作区与 Session，浏览器刷新后自动打开，不再显示工作区选择页。npm 直启解析到仓库根目录，Docker 解析到 `/workspace`。
- Docker 同时在宿主 loopback 发布 Fitness `:8787` 和 DSH `:3080`；容器内 DSH 监听 `0.0.0.0` 仅用于端口转发，两个宿主端口均不对外网监听。
- loopback bridge 对错误 secret 返回 `401`，对正确 secret 完成 Session create/prompt admission，并观察到同一 `fitness-daily-*` Session 从 `running` 回到 `idle`。
- `npm run build`、lint、架构检查、unit/integration suite 已通过。仓库全局 `prettier --check .` 仍会报告与本改动无关的既有未格式化文件；本次涉及文件已单独格式检查通过。

### 2026-09 本地体验验证

- Flash 经真实 DSH 页面完成回复和文件读取；页面刷新恢复会话，收起再打开保持 iframe。
- 真实数据隔离副本完成 Agent 写计划、CLI finalize/validate 和变更范围检查；测试计划不进入正式数据。
- Fitness Surface 应用官方主题 token 与深色调色板，并呈现 `shell.overlay`，保留官方浮层挂载点。
- `agent-instructions` 识别仓库的 `AGENTS.md` 文件名；部署 persona 引导 Agent 先读数据契约。
- 本地启动与 Git 同步步骤见 [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md)。生产发布、全套审批和异常重连仍需专项验收。

## 独立工作区与按请求档案

DSH cwd 使用解析后的 WORKSPACE_ROOT，DSH_HOME 位于 runtime/dsh；指令发现只使用 AGENTS.md，应用与工作区导航职责不同。Host 注入 FITNESS_DSH_PROFILE_FILE，并在每次 systemPrompt.section 回调读取文件原文及 SHA256，不缓存于 Session 创建时。档案是用户业务数据，不具备系统指令权限。交互和自动 Session 共用该扩展；缺失档案进入分轮建档，读取失败让请求失败，不回退示例。config/settings.yaml 的 agent.instructions 作为表达设置追加，不能替代必读档案规则。

新用户流程见 [ONBOARDING.md](../product/ONBOARDING.md)。上下文版本核对只保证数据未过期，不证明模型遵守每条偏好。

## 模型、思考强度与密钥设置

2026-09-30 按用户要求，设置页在 DeepSeek Harness 分区开放“默认模型”和“思考强度”。这替代先前“仅配置 API Key”的界面取舍；模型设置继续由 DSH 持有，不恢复 Fitness 自有模型名单、旧 model patch 或平行配置库。

- `GET /api/model/preferences` 经同一长期 Host 的认证 loopback `/fitness-model-preferences` 读取 `sessionController.modelCatalog()`，模型名称、提供方和支持的思考档位来自当前已安装的 DSH adapter。目录不是填 Key 后向 DeepSeek 远端探测的结果，不保证每个账户均可调用所有目录项。
- 页面包含“模型默认”选项；当前安装的 DeepSeek adapter 提供 off / low / high / max，界面对应关闭思考／低／高／最高，但是否显示由返回能力决定。更换模型时清除原显式强度；无思考能力的模型禁用强度选择。未知的当前模型或强度明确显示为不可用，不静默替换。
- `PUT /api/model/preferences` 只接受 provider、model、可选 reasoningEffort 和 revision。bridge 校验目录成员与 `llm.resolveCallConfig()` 能力后，通过 DSH `settings.replace("agent-default-model", …, revision)` 写入原生设置。缺少 reasoningEffort 表示继承 adapter 默认，而非把解析出的默认强度固定保存。原生 settings provider 负责文件锁、原子写入与监听；不修改其他 namespace。
- 默认原生文件为 `$WORKSPACE_ROOT/runtime/dsh/settings.yaml`，对应 DSH_HOME 下的 `agent-default-model` 分节。直接修改该文件后，DSH watcher 更新内存；页面通过“重新读取”获取最新值，未做轮询自动覆盖编辑中的草稿。原生 revision 冲突返回 409，保留草稿并要求重新读取；只读、目录读取失败和无效组合均有明确反馈。
- 生效范围遵循 DSH：尚无会话级选择／请求记录的会话使用默认值；新对话与新建的自动任务 Session 因此使用新配置。已有请求记录或显式选择的会话保留原选择，含正在执行或重试的旧自动任务 Session。页面不批量改写历史 Session，也不把保存默认值描述为下一条已有对话必然切换。

Fitness Host 仍不读取 `config/settings.yaml` 的旧 model 字段生成 `agent-default-model` patch，不传递旧 `DSH_PROVIDER` / `DSH_MODEL` 环境覆盖，不恢复旧 `/api/model/selection`。旧 model 数据只保留既有兼容解析与迁移，不删除用户文件。模型基础目录和默认值随锁定的 DSH 版本维护，用户覆盖经上述原生 settings seam 生效。

凭据继续独立通过 `/api/model/settings` 和同一 Host 的认证 bridge 写入 `DEEPSEEK_API_KEY`，页面只读取 configured / writable，不返回 Key。模型设置与密钥各自保存，互不清空未提交输入；环境密钥只读不等于模型偏好只读。保存密钥或默认模型均不代表已完成真实模型连通性验证。

验收入口：`tests/integration/dsh-installed-host.test.ts` 使用真实已安装 Host 与本地 fixture adapter，覆盖模型能力、拒绝非法输入、revision 冲突、原生落盘、外部编辑监听、无关设置保留、旧会话选择稳定、新自动任务采用新选择、清除显式强度及 Host 重启后的持久性。`model-settings.test.ts` 验证同源转发和错误状态；`ModelPreferences.test.tsx`、`appearance.spec.ts` 覆盖页面错误恢复、只读、草稿保留、动态选项与独立保存。真实 DeepSeek 调用与生产拓扑未由这些无 Key 测试验收。


## 2026-09-13 DSH 0.1.5-rc.2 升级

此增量属于现有“DSH Surface 与统一 Host”。依赖与 lockfile 锁定 0.1.5-rc.2；该版本为候选版，核对时 npm latest 仍指向 rc.1，不使用浮动标签。

- 按用户要求不建设旧会话／旧数据迁移兼容层；使用新 DSH 状态验收。个人 fitness YAML 不因 DSH 升级清除，应用也不解析或复制官方会话日志。
- 教练 section 排序使用 `DEPLOYMENT_PERSONA_SUFFIX`；仍在每次请求读取当前档案原文与 revision，不缓存到 Session 创建时。
- Surface 注册 `main`、`rightbar`、`shell.overlay`，提供 panelInfo、selectPanel、beginNavigation；预览使用官方 Sidebar。uiWorkspace 已依赖 layout，Surface 不能再把 uiWorkspace 声明为启动依赖，操作时通过 `ctx.get()` 获取它，避免循环。
- 新版官方品牌插槽的 fallback 由空 occupant 覆盖。通过官方语言扩展 `zh-fitness`（回退 zh）提供训练入口文案，保留其余官方中文交互；移除依赖上游 CSS 编译类名的覆盖。
- `tests/integration/dsh-installed-host.test.ts` 启动真实安装的 Host，并使用测试专属、本地固定回复 LLM adapter：验证 bootstrap、bridge 认证、入队与重复请求、按请求档案、浏览器回复与刷新恢复、新会话。测试插件只在临时 profile 挂载，不进入正式 profile，不需要 Key。

上游依据：[rc.2 发布](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-rc.2)、[rc.1 破坏性变更](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-rc.1)。真实 DeepSeek 模型、旧会话迁移及生产子域部署不由无 Key 回归推断验收。


本轮验证结果：lint、design lint、architecture lint、typecheck 与完整 build 通过；48 项单元／组件、40 项集成测试通过（含真实已安装 Host + Chromium、本地固定回复与官方 read 工具）。桌面／手机文件预览已实际审图，见 VISUAL-REVIEW.md。本机服务已使用新版及全新 DSH 状态启动，旧 runtime/dsh 移至 runtime/dsh-pre-015-时间戳，不自动迁移或读取旧会话；个人训练 YAML 和应用配置保留。本机凭据文件仅有浏览器凭据，缺少 DEEPSEEK_API_KEY，真实模型检查返回 MISSING_CREDENTIAL，因此未完成真实模型回复与业务写入验收。生产子域、完整审批与异常重连矩阵仍未验收。

页面回归：app 与 session-history 共 8 项聚焦 E2E 已通过；最后一轮 7 项通过，设置文案同名定位调整为 exact 后单项复跑通过。由于并行测试占用默认端口，本轮通过临时 Playwright 配置使用独立端口；测试中的计划请求和剪贴板权限已改为使用 baseURL。未执行全量 E2E 或生产部署。

## 首次密钥配置与读取失败恢复

密钥状态读取失败不代表凭据只读。配置页允许在状态未知时填写 Key；读取结束后可尝试保存，由同一 Host 的凭据控制器执行权限校验。已明确 `writable: false` 的环境凭据仍禁止编辑。读取失败显示“密钥状态暂不可用”，不继续显示正在读取，也不将未知状态宣称为未配置。保存失败保留输入供重试，成功后立即清空。

验证入口：`DeepSeekSettings.test.tsx` 覆盖正常保存、读取失败后的保存恢复、环境凭据只读；`tests/integration/empty-workspace-credentials.test.ts` 使用临时空工作区启动真实 `npm run dev`，通过 Vite 页面与实际 DSH Host 验证首次写入和刷新。第二种场景仅注入初次 GET 503，恢复后 PUT 仍写入真实临时凭据存储。使用虚构 Key，不调用真实模型。当前机器正常首次启动未复现读取失败，因此这些结果不能证明用户机器上的服务失败原因已修复。

本地服务在 `npm run dev` 终端记录 DSH Host 启动、就绪和退出原因，以及 `/api/model/settings` 或 `/api/model/preferences` 返回 503 时的 Host 状态与对应 bridge 类型。Host 启动日志不输出带浏览器 token 的 URL；退出原因仅保留错误摘要并遮盖已知密钥。工作区从其他路径恢复时，`runtime/dsh` 可能包含无法在新路径使用的 Session 和安装目录缓存；若 Host 报目录类型冲突或 Session 所属路径冲突，先停止服务，归档整个 `runtime/dsh` 后再启动，保留 `fitness/` 和 `config/`。归档的旧 Session 不自动迁移。

## 2026-10-07 可选 TextIn 文件解析

设置 → 文件解析管理 `config/settings.yaml` 的 `xparse.enabled` 与 `xparse.allowPaid`，旧配置缺少此分节时均默认为 false。开关与凭据分别保存，不覆盖教练、模型或自动计划设置。页面说明开启后在对话中提供 DSH 可访问的文件路径、链接或附件，由 DSH 解析和整理健身记录；用户电脑路径必须先上传或变为服务可访问的文件。PDF、图片与 Office 使用 TextIn 云端，结构化 CSV/JSON/YAML 可以直接本地读取。

项目运行时依赖锁定 `xparse-cli@2.5.0`。npm 分发 Node 启动器和平台 Go 二进制，随部署安装，Host 不让 Agent 安装或升级。`fitness-automation-bridge` 的原生 Skill provider 提供 `xparse-parse`，正文位于应用包的 `xparse-skill/`；上游快照固定为 intsig-textin/xparse-skills `3662e0be9750cb57796a768015fc1e5fff29a793`，项目入口明确覆盖其安装、认证、输出目录和可用命令规则。

开关关闭时 provider 不返回技能，技能正文加载返回不存在，`xparse` 工具注销；开启时注册同一原生工具。设置监听（250 ms）与每轮 `agent/pre-step` 同步目录缓存，每次执行及凭据解析后再次检查开关，配置缺失/损坏按关闭处理。无需重启 Host。关闭会取消当前本地 CLI 进程，但不能撤销已提交云端 Task；历史 Session 中读过的指令和结果不会被删除，不能承诺模型遗忘历史知识。

原生 `xparse` 工具通过无 Shell 的参数数组调用项目 CLI，仅开放解析、额度、文档导航和解析 Task 的 run/status/read/export/debug/resume/continue。禁用任意 endpoint、profile、认证、输出目录、安装和 verbose 参数；Host 固定 TextIn 国内 endpoint，输出与缓存位于工作区 `runtime/xparse/`。Task 上下文私有文件由 Host 创建、调用后删除；非零退出码和上游结构化错误原样保留（凭据值遮盖），不会把进程退出等同业务导入成功。默认 auto 免费优先；未允许付费时拦截 paid、任务 resume/continue 等可能恢复已授权付费工作的操作。云端任务标识必须保留，超时不允许重复创建任务。这个入口不提供服务端语义抽取或篡改检测。

凭据采用 App ID / Secret Code，作为一个 JSON 值经 DSH credentialsController 原子写入引用 `FITNESS_XPARSE_APP_CREDENTIALS`，默认落在工作区 `config/dsh-credentials.yaml`，不写普通 settings 或训练 YAML。GET 只返回 configured/writable；PUT 成功后页面清空输入，失败保留草稿，显式清除调用原生 unset。可以通过同名环境变量提供 JSON 对象 `{ "appId": "…", "secretCode": "…" }`，此时遵循原生只读覆盖规则。解析时从 credentials provider 按次读取，通过子进程环境注入，不传命令行或 Agent 参数；强制 app-key 身份，不继承 CLI 的个人 OAuth 登录。当前没有 OAuth 网页登录接入；已有全局 CLI 登录不会自动导入。保存凭据不代表已验证真实 TextIn 连通性。

边界：这是现有单机单用户 Host 的配置，不是多租户账号隔离。原生 guard 同时拒绝常见 Shell 工具直接调用 xparse-cli / 安装技能 / 引用其凭据，但字符串检测不是通用 Shell 沙箱；拥有任意同 UID Shell 和文件访问的 Agent 仍可能通过自编程、网络或读取应用文件绕过。当前保证项目提供的发现、加载与执行入口受开关控制，不声称阻止恶意任意代码。需要强制全局隔离时必须增加独立进程身份、文件权限与网络策略，不用提示词或正则冒充。

历史 workout 通过独立 `import workout <draft-yaml> <source-file>` 命令落盘；不伪造计划。来源归档、确定性计算、重复日期拒绝与路径保护见数据架构。Task 结果和 DSH Session 均不是训练数据源；导入完成以 Fitness CLI 与 validate all 为准。
