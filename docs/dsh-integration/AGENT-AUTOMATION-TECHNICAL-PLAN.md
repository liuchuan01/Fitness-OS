# AI Fitness OS Agent 自动化技术方案

## 1. 结论与边界

本次升级由 training 应用拥有健身业务、调度触发和 HUD；DSH 官方 Host/Web Client 完整拥有
Agent 会话、历史、事件投影和聊天渲染。training 不再实现一套平行 Conversation 系统：

```text
React/Vite Fitness HUD
  ├─ Chat Launcher ───────────────> DSH 官方 Web Client
  ├─ Dashboard projection <────┐      ├─ Session / History
  └─ 调度配置 ──────────────┐  │      ├─ Streaming / Tool UI
                            v  │      └─ Markdown / Approval
                  training Node service         │
                    ├─ Scheduler                │
                    └─ 确定性 data-store        │
                            │                   │
                            └──────> DSH Host/runtime
                                             │ bash / fs
                                             v
                         profile.yaml + AGENTS.md + data/*.yaml
```

当前项目不是 Next.js：前端是 React/Vite，后端是 `server/index.ts` 启动的 Node HTTP service。
该 service 已经长期运行，适合继续成为应用进程，并在内部增加持久调度器。

核心决策：

- 不使用 systemd timer。宿主机或容器平台只负责保证应用进程存活；业务触发时间由应用配置。
- 第一阶段不引入 fitness MCP，也不为每种业务维护一套 Agent 工具 schema。Agent 按
  `AGENTS.md` 使用 bash/fs 读取和修改工作区。
- DSH 是会话、历史、流式事件、Markdown、工具交互、Approval 和持久化的唯一事实源。HUD 只负责
  唤醒、承载和收起 DSH 官方 Chat，不复制消息或 Session 状态。
- 自动任务也必须进入 DSH 官方 Session/runtime。training Scheduler 只负责计算 occurrence、claim、
  retry 和业务验收，不拥有 Agent 对话循环。
- YAML 仍是唯一正式数据源。Agent 负责语义决策和 draft；确定性代码负责 schema 校验、刺激计算、
  冲突检查和最终验收。
- 后续增加食谱、热量规划时，主要扩展 YAML、Agent 指引和本地 schema/计算，不同步扩展 MCP。
- 容器只挂载必要目录：应用代码只读，`data/` 和明确的 runtime 目录可写。workspaceRoot 不是容器
  隔离；真正的写入边界由容器 volume 和运行用户权限提供。

## 2. 现状与 MCP 取舍

`data/` 已经是正式 YAML 数据源，`AGENTS.md` 定义了 Agent 的读写规则。现有 service 的
`server/data-store.ts` 已提供 schema、确定性计算、备份和原子 rename；这些能力继续复用。

MCP 适合跨进程、跨语言、跨应用复用稳定语义能力；当前 fitness Agent 与数据同仓、同机、单用户，
且数据形态会持续演进。现在引入 MCP 会形成三份同步契约：

```text
YAML/schema <-> training service API <-> MCP tool schema
```

例如增加食谱时，不仅要新增 YAML 和校验，还要同步新增或修改 MCP 工具。对当前阶段，这属于重复
建模。Agent 直接操作文件也不等于无约束：推荐边界是 `Agent.md` 规定语义规则，容器权限限定可写
目录，本地 CLI 负责确定性 validate/finalize，Session 事件和文件 diff 提供审计。

只有未来出现以下任一需求时再引入 MCP 或 Harness 原生 capability：第三方 Agent 也要调用、远程
调用而不能挂载文件、需要细粒度工具级授权、需要隐藏底层文件布局，或出现多个独立数据后端。

## 3. 应用内持久调度

### 3.1 调度配置

UI 提供“自动计划”设置页，第一阶段配置保存到 `config/settings.yaml`：

```yaml
schema_version: 1
daily_plan:
  enabled: true
  local_time: "09:00"
  time_zone: Asia/Shanghai
  missed_run_policy: run_once
```

```text
GET /api/automation/schedule
PUT /api/automation/schedule
POST /api/automation/daily-plan/run-now
```

`PUT` 是完整快照保存：完成 schema 校验和原子写入后，通知 Scheduler 重新计算。未配置时默认
`enabled: false`，不能静默开启自动写入。“立即运行”走同一调度主链路，不绕开幂等和日志。

### 3.2 调度状态

只保存配置不够。容器在 09:00 停机、09:30 恢复时，需要知道当天任务是否已经处理。
Scheduler 持久化最小运行状态到不提交 Git 的 `runtime/automation/state.yaml`：

```yaml
schema_version: 1
daily_plan:
  last_scheduled_for: 2026-08-31T09:00:00+08:00
  last_status: succeeded
  last_session_id: fitness-daily-2026-08-31
  last_finished_at: 2026-08-31T09:02:14+08:00
  last_error:
```

完整执行细节进入结构化日志或 `runtime/automation/runs/`，不能混进 plan/workout schema。

### 3.3 触发算法

不能只使用一个内存 `setTimeout(24h)` 或普通 cron callback。采用分钟级 tick 加持久状态对账：

1. 启动和每次 tick 读取当前有效配置；
2. 用显式 `time_zone` 计算最近一个应触发 occurrence；
3. 若 occurrence 晚于 `last_scheduled_for`，原子 claim；
4. 创建固定 Session ID `fitness-daily-YYYY-MM-DD` 并运行 Agent；
5. 完成后持久化状态；失败保留 error，按有限退避重试；
6. `missed_run_policy: run_once` 只补最近一次，不枚举停机期间全部历史任务。

单实例部署时用进程内 mutex 串行 claim 和状态写入。若未来副本数大于 1，YAML 无法提供分布式
抢占，必须增加 SQLite/数据库锁或单独选举 scheduler leader。第一阶段容器副本固定为 1。

### 3.4 每日任务语义

Scheduler 只发送确定的日期、时区和触发时间，不决定今天练什么。Agent 按 `AGENTS.md` 读取
profile、覆盖日期的 program、最近 workout、metrics、muscle map 和目标日期已有文件：

- 非训练日或 recovery slot：不写 plan；
- 没有覆盖日期的 program：返回 `no_active_program`；
- 当天已有 workout：返回 `already_completed`；
- 当天已有 plan：返回 `already_exists`，自动任务不得覆盖；
- 适合训练且无计划：创建 plan draft，再运行本地 finalize/validate 命令。

业务幂等键是日期和任务类型，而不是 Session ID。容器断连后重试必须先检查目标文件。

## 4. DSH 官方会话系统嵌入

### 4.1 唯一会话事实源

UI 对话不得只调用 `@deepseek-ai/dsh-sdk-client` 的 `run()` 后保存 `finalResponse`。该接口适合
Headless 调用，但不足以复用 DSH Web 已有的 Session history、Conversation projection、工具卡片、
Approval、流式 Markdown 和恢复能力。页面聊天使用 DSH 官方 Host/Web Client 完整链路：

```text
HUD central host
  -> official `dsh web` page (isolated iframe)
  -> DSH Client Modules / Cordis plugin graph
  -> ui-conversation + ui-chat
  -> DSH Host RPC / Session Event Log
  -> Agent loop / tools / workspace
```

`ui-chat` 不是接收 `messages` 属性的独立 React 组件，不能抽出后再由 training 自行喂事件。它依赖
DSH 的 Client Modules、API Gateway、Slots、Session binding 和 Conversation projection。当前锁定版本的
`AppWebEntry` 依赖 Host 注入的 `window.__DSH_BOOT__`、Client Modules bundle graph 和 `/api/remote.mux`，
不是可直接挂入另一个 React root 的独立组件。因此 training 由服务端启动官方 `dsh web` Host，中央
HUD 通过隔离 iframe 加载其完整页面；不得复制 `AssistantMarkdown`、`PartialAccumulator` 或 Tool
presenter 到 training，也不得向 iframe 注入或改写 DSH DOM。

DSH 持有两类 Session：

- 自动任务：`fitness-daily-YYYY-MM-DD`，按日期隔离；
- UI 对话：由 DSH 官方 Session/Conversation 机制创建、列举、恢复和持久化；
- 两者共享 training workspace、`AGENTS.md` 和 `data/**`，但使用不同 Session。

### 4.1.1 Workspace 首次注册与容器化

本地 macOS 的 `dsh web` 默认采用 DSH 官方 native directory picker。首次将 training 目录加入
Workspace 列表时，点击 DSH UI 的 “Add workspace” 会弹出系统目录选择器；这是 DSH Host 对本机文件
访问的安全边界，浏览器自动化不能也不应伪造该系统授权。当前交付保留这一官方首次操作，不改写
`DSH_HOME/storages/workspace.json`。

容器化部署时没有图形目录选择器，Bootstrap 应走 DSH 官方 `workspace/create` Remote API：容器以
`WORKSPACE_ROOT=/workspace` 启动 DSH Host，启动钩子对 `/workspace` 发起幂等 `workspace/create`，再由
Web Client 打开该已注册 Workspace。`DSH_HOME` 必须挂载为持久卷，以保留 Workspace、Session 和
credentials；不得通过 training 自建 JSON 模拟 DSH Workspace registry。该 Bootstrap 与公开地址/端口
配置属于容器化迭代，不是本地 HUD 实现的一部分。

DSH Web 还是独立的浏览器 Host：容器部署必须为它配置可由浏览器访问的 public origin（或由反向
代理把它完整代理到独立 origin），并在 `dsh web` 上设置对应 `--host` / `--trusted-host`；不能把
Host 启在容器 `127.0.0.1` 后把该 URL 直接返回给远端浏览器。WebSocket `/api/remote.mux`、静态资源
和认证 cookie 都必须保持在同一个 DSH public origin。当前 compose 只暴露 Fitness 服务端口，因此
这一网络发布是容器化迭代的显式前置条件。

同一可写 workspace 同时只能有一个 Agent 执行。首选由一个 DSH Host 同时承载 Web 会话与自动
Session，并使用其官方排队能力串行执行。实施前必须用当前锁定版本验证 Scheduler 可调用的官方
Host 接口；若当前版本只允许 SDK 启动独立 `dsh --profile sdk` 子进程，不能静默并行启动第二个
可写 runtime。此时先升级/扩展 DSH 官方 Host 能力，或为两个官方入口增加共享 workspace claim，
不得在 training 内重建 Session/事件系统来绕过限制。

### 4.2 HUD 与 DSH 的接触边界

HUD 与 DSH 只有三个正式接触点：

1. **会话唤醒**：HUD 打开中央 iframe host，启动或恢复 DSH 官方 Web Client；发送、历史、流式、
   Markdown、工具调用、Approval 和错误恢复全部留在 DSH 内。
2. **共享业务目录**：DSH workspace 指向 training 根目录，Agent 按 `AGENTS.md` 读写
   `fitness/profile.yaml` 与 `data/**`；HUD 通过现有 data-store 读取相同文件并生成 Dashboard projection。
3. **每日调度**：training Scheduler 在 claim occurrence 后通过 DSH 官方入口唤醒固定自动 Session；
   DSH 完成后，Scheduler 继续执行确定性 validate、写入边界审计和业务 outcome 判定。

HUD 允许监听“Session 本轮结束”这一宿主生命周期信号，用于调用现有 `refreshDashboard()`；该信号
只触发重新读取 `data/**`，不得携带或复制完整消息历史。

### 4.3 对话入口与视觉容器

聊天入口直接放入现有 React 应用。展开后承载的是 DSH 官方 Web Client，不是 training 自制聊天
组件；外层仍采用中央 Overview 毛玻璃 HUD，不增加独立路由、顶栏入口或右栏 tab。

关闭状态下，Body Canvas 最下方中央只显示一个低高度圆角输入框：

```text
                 ┌──────────────────────────────┐
                 │ 和训练 Agent 说点什么…      ↑ │
                 └──────────────────────────────┘
```

- 输入框位于中央 `body-stage` 内，不进入右侧 Context Panel；
- 宽度随 Canvas 响应式变化，桌面保持克制，不横跨整个页面；
- 关闭状态的 launcher 只负责唤醒 DSH；输入草稿若不能通过 DSH 官方接口无损交给 Chat composer，
  则 launcher 退化为单击打开，不能另建一条自定义消息提交链路；
- 若 DSH 官方 embed API 支持 composer prefill/submit，输入框存在文本时按 Enter 唤醒并提交，
  Shift+Enter 换行，空输入不创建会话；否则 launcher 不提供文本编辑，打开后在 DSH composer 输入；
- Today Plan 阅读模式是否保留入口由页面空间决定，第一阶段只在 3D Body Canvas 模式显示。

唤醒后，毛玻璃层覆盖完整中央 Overview/Body Canvas，但不覆盖左侧 Timeline 和右侧 Training
Rhythm。它属于中央舞台上的临时宿主，不替换 3D 场景：

```text
┌──────────────────────────────────────────────┐
│            3D Body + 原有 HUD                │
│                                              │
│  ╭────────────────────────────────────────╮  │
│  │              Agent 对话               │  │
│  │                                        │  │
│  │  用户消息 / Agent 回复 / 业务结果卡片  │  │
│  │                                        │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │ 继续输入…                     ↑ │  │  │
│  │  └──────────────────────────────────┘  │  │
│  ╰────────────────────────────────────────╯  │
└──────────────────────────────────────────────┘
```

- 对话层占满中央 Canvas；通过半透明材质保持 3D 人体可见；
- 毛玻璃层后面的 3D Body、空间 HUD 和当前投影继续渲染，不卸载、不切换模式；
- 展开层内部消息独立滚动，输入框固定在层底部；滚动聊天不得带动 Body Canvas；
- 对话时无需操作人体。保留之前的 3D Body 与 HUD 作为低亮度背景，不增加“旋转身体”模式；
  iframe 正常接收指针，不将透明区域解释为可透传操作。目标是延续当前应用场景，而非进入独立聊天页；
- 用户可通过顶部细把手向下收起，收起只隐藏对话层，不终止正在运行的 Agent；
- Agent 生成/修改计划或记录 workout 后，背景中的人体投影和 HUD 使用现有数据刷新链路更新，
  对话层不复制一套完整 Dashboard；
- DSH 的工具卡片、流式过程、Markdown 和 Approval 使用官方呈现；HUD 只覆盖主题 token 和外层
  几何约束，不修改 DSH SessionEvent 语义。

training 不提供 `POST /api/conversations`、`GET /api/conversations/:id`、messages 或 events 等平行
Conversation API，也不保存 `runtime/conversations.json`。历史查询、断线恢复和 Session replay 均
由 DSH Host 提供。

制定/修改计划、记录完成结果、查询训练历史，以及未来的食谱和热量规划，都由 Agent 读取
`Agent.md` 和文件完成，不为每个 intent 增加 controller 分支。

### 4.4 视觉语言与嵌入约束

本交互遵循仓库 `docs/design/DESIGN.md` 的既有设计系统：`Body is the Interface`，人体是第一视觉焦点；
视觉气质是 Biometric command canvas、Premium minimal、Tactical clarity 和 Calm futurism。
Cyberpunk 只取战术信息语言和精密控制感，不采用满屏霓虹、重描边、扫描线或游戏装备面板。

- 毛玻璃只用于悬浮在 3D Canvas 上的对话入口与展开层，符合现有 Glass blur 使用边界；
- 背景使用深黑蓝半透明材质、轻微 blur 和细弱冷色边线，保证人体轮廓仍可辨认；
- 强调色复用现有低饱和冰蓝 `#7dd3fc` / `#38bdf8`，只用于发送、运行状态和已完成动作；
- 标题与正文沿用 Space Grotesk / Inter，时间、状态和技术标签沿用 JetBrains Mono；
- 不使用机器人头像和彩色左右气泡；用户与 Agent 通过排版、间距和微弱底色区分；
- 展开动画强调空间层级而非炫技：短距离上移、透明度和 blur 同步过渡，并尊重
  `prefers-reduced-motion`；
- 对话层不能让右侧 Context Panel 重新排版，也不能遮住左侧 Time Rail；它只覆盖中央 Canvas。

DSH 官方 UI 的功能结构和消息渲染保持不变。当前适配只发生在 HUD 外层的尺寸、玻璃背景、iframe
整体透明度和 pointer-event 边界，不 fork DSH 组件 CSS，也不跨 origin 访问其 DOM。待 DSH 提供
正式 embed composition/公开主题 token 后，可将 iframe Host 替换为官方 mount API；替换不得改变
training 与 DSH 的三点接触边界。

桌面端维持上述 Canvas 内覆盖。小屏下仍从底部拉起，但可提高至约 75dvh；保留一段可见的 3D
背景和明确收起手势，不再套用现有右侧 Insights bottom sheet，避免两个 sheet 共享同一层级。

## 5. 文件写入与确定性收口

### 5.1 Agent 可写边界

开发环境中 Harness cwd 固定为 training 仓库。容器化后建议：

```text
/app                         只读应用代码
/workspace/profile.yaml      只读或显式可写
/workspace/data              可写业务数据
/workspace/runtime           可写运行状态
```

Agent 只获得 `/workspace` 视图。若允许它维护 `AGENTS.md`，该文件随数据可写；否则单独只读挂载。
密钥不放在 workspace，也不输出到 prompt、YAML 或 Session 日志。

### 5.2 通用本地 CLI

不新增 MCP，但 `computed`、schema 和冲突不能交给模型。把现有 data-store 能力暴露为少量通用 CLI：

```text
npm run fitness -- validate plan <path>
npm run fitness -- finalize plan <path>
npm run fitness -- finish-workout <plan-path> <actual-draft-path>
npm run fitness -- validate all
```

- `validate` 只读校验；
- `finalize plan` 拒绝手写 computed，校验 draft、计算预期刺激、备份并原子写入；
- `finish-workout` 复用 `finishWorkoutFromPlan()`，不推测用户未报告的 RPE/readiness；
- CLI 与 HTTP service 调用同一领域函数，不复制 schema 和计算逻辑。

新增食谱时，Agent 可以先读写新的 YAML；只有确实需要程序保证的营养计算或状态转换时，才给
通用 CLI 增加 validator/finalizer，不同步维护远程工具协议。

### 5.3 并发和失败

- Agent runtime 全局并发 1，自动任务和对话写操作排队；
- 最终写入继续使用 `.tmp -> rename` 和已有 `.bak`；
- create 前后检查目标文件，自动任务绝不 revise；
- Agent 失败但文件已落盘时，重试先执行 validate 和存在性检查；
- 非法 YAML、手写 computed 或 schema 错误使任务失败，不记录成功状态；
- 手工在宿主机直接编辑仍可能与 Agent 竞争，这是明确的单用户边界；UI 应展示 Agent 正在运行。

## 6. 容器部署与安全

部署包含 Fitness Web/Node service 与 DSH 官方 Host。两者可以位于同一容器进程组或同一 Compose
应用，但 DSH Host 必须使用其官方启动入口，不能由 training 复制 Host 内部模块。部署不运行
systemd；容器编排负责进程重启、healthcheck、固定一个可写副本、持久 volume、凭据和资源限制。

“调度放进容器”本身不会自动更安全。安全性来自非 root 用户、只读 root filesystem、最小 volume、
不挂 Docker socket、限制出站网络和不把凭据放入 workspace。停机期间补跑由持久 scheduler state
保证。

## 7. 页面与验证

自动化设置页展示启用状态、本地时间、时区、下次运行、最近一次状态/错误和“立即运行”。聊天不
作为独立 Fitness 路由存在；Body Canvas 底部 launcher 唤醒中央 DSH Chat，历史管理使用 DSH 官方
UI，不再由 Fitness 页面维护历史栏。

验证重点：

1. Scheduler：时区、跨日、配置修改、禁用、容器重启补跑、只补最近一次；
2. 幂等：同一 occurrence 只 claim 一次，失败重试不重复创建 plan；
3. Runtime：一个 Harness 多 Session、全局串行、退出回收和异常重启；
4. Agent：训练日创建、非训练日 no-op、无 program、已有 plan/workout；
5. 文件：所有 Agent 修改通过真实 CLI finalize/validate，computed 只能由程序生成；
6. 容器：只读应用、最小可写 volume、09:00 停机后恢复补跑；
7. DSH 嵌入：官方 Session 历史、replay、流式 Markdown、Tool UI 和 Approval 在 HUD mount point
   内工作；断线重连不丢历史，页面中不存在每秒轮询或第二份 conversation 持久化；
8. 对话 UI：关闭时只有底部 launcher，展开后只覆盖中央 Overview；Timeline 和 Training Rhythm
   不被遮挡，3D 与 HUD 保留可见、对话时不操作人体，收起不终止 DSH Session；
9. 视觉回归：对照 `docs/design/DESIGN.md` 检查人体仍是第一焦点、对话层没有霓虹/扫描线堆叠，且
   reduced-motion、键盘操作、焦点管理和对比度可用；
10. 日志：occurrence、DSH session id、结果、变更文件、耗时和稳定错误码。

迁移时必须删除当前实验性的 `ConversationStore`、`runtime/conversations.json`、Fitness Conversation
API、前端轮询/SSE 投影和自制 Markdown/Tool 展示。迁移验收前不得保留两套聊天入口作为 fallback；
现有历史若需要保留，只允许一次性导入 DSH 官方 Session 存储，不长期双写。

## 8. 后续演进

新增主链路是：

```text
HUD launcher -> DSH 官方 Web Client/Host -> DSH Session -> Agent 文件操作
持久 Scheduler -> DSH 官方自动 Session -> Agent 文件操作 -> CLI 确定性收口
```

未来增加食谱和热量规划时，新增 YAML/schema，更新 `AGENTS.md`，按需增加确定性计算与 CLI，
再增加 UI projection。只有出现跨应用远程能力边界时，才从稳定领域函数向外投影 MCP；届时 MCP
是 adapter，不是领域实现。

尚待确认：缺少当天 readiness 时，自动任务是否仍生成计划。建议允许生成并保留
`readiness: {}`，不得推测恢复数据；若近期记录存在疼痛或异常疲劳，则降低负荷或不生成。
