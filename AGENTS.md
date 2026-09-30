# AI Fitness OS Agent 指令与路线图

本仓库工作语言为中文。产品、架构、数据契约、AI 行为与技术决策以 `docs/` 为唯一长期事实来源；不得把聊天记录、临时笔记或代码注释当作正式设计依据。

历史 `back/` 3D demo 已移除，不得恢复或将其作为当前架构、资产或实现入口。

`prompts/` 已移除：训练计划不再由 Fitness 服务直接调用模型生成，Agent 行为由 DSH Host 的 profile、skill 与 Session 上下文管理。

## 文档导航

后续 Agent 先根据任务类型阅读对应文档，不要无目的地遍历全部材料。

| 任务 | 必读文档 | 需要时继续阅读 |
|---|---|---|
| 产品范围、功能取舍 | `docs/product/PRD.md` | `docs/notes/OPEN-QUESTIONS.md` 仅作待定事项，不是已确认决策。 |
| 数据分离、新用户建档 | `docs/data/FITNESS-DATA-ARCHITECTURE.md`、`docs/product/ONBOARDING.md` | 原始方案见 `docs/notes/DATA-SEPARATION-AND-ONBOARDING-PROPOSAL.md`，验收见 `docs/engineering/DATA-SEPARATION-VALIDATION.md`。 |
| 一般 UI、布局、交互 | `docs/design/DESIGN.md` | `docs/body-3d/*`、`docs/data/MUSCLE-HISTORY.md`；涉及 Agent 会话时再读 DSH 集成文档。 |
| 3D 人体、肌肉映射、模型资产 | `docs/body-3d/3D-BODY-POC-VALIDATION.md` | `3D-MODEL-ASSET-RESEARCH.md`、`3D-MUSCLE-TAXONOMY-ITERATION.md`。 |
| YAML、训练计划、workout、指标或 Agent 写入 | `docs/data/FITNESS-DATA-ARCHITECTURE.md` | `Data-AI-Interaction-Design-v0.1.md`、`PROGRAM-DATA-MODEL.md`。 |
| AI 功能、Agent 输入输出职责 | `docs/dsh-integration/DSH-FITNESS-INTEGRATION.md` | 涉及业务文件读写时再读 `docs/data/FITNESS-DATA-ARCHITECTURE.md`。 |
| DSH 页面、Session、自动任务、事件或部署 | `docs/dsh-integration/DSH-FITNESS-INTEGRATION.md` | `docs/dsh-integration/AGENT-AUTOMATION-TECHNICAL-PLAN.md`。 |
| 服务、前端、测试、依赖或代码组织 | `docs/engineering/TECHNICAL-ARCHITECTURE.md`、`docs/engineering/CODING-STANDARDS.md` | `docs/engineering/ENGINEERING-NOTES.md` 用于历史经验，不覆盖当前设计。 |

## 不可突破的边界

- YAML 是当前 Fitness 领域数据的正式来源；DSH Session persistence 只保存会话与事件，不能成为第二份训练数据库。
- 计划、真实 workout、指标、调度状态和 DSH Session 是不同生命周期对象，不能混写或互相替代。
- AI 可以作语义判断和写业务 draft；本地 data-store / CLI 负责 schema 校验、确定性计算、原子写入、文件边界审计和最终业务结果。
- Agent 或 DSH 空闲/退出不代表业务成功；自动任务必须以 Scheduler 的 claim、重试和文件校验结果判定。
- 不重新引入 `rolling_summary.yaml`、平行 conversations/messages/events API，或由 Fitness 保存 DSH 消息副本。
- 第一阶段不为 Fitness 数据域建立 MCP 工具矩阵。只有出现跨应用远程调用、稳定第三方复用、细粒度授权或多数据后端时，才重新评估 MCP。
- 3D 运行时资源使用轻量 GLB/glTF，不批量加载原始 STL；人体只包含皮肤和训练相关肌肉，四肢完整，不包含骨骼、器官或生殖器。
- UI 必须遵守 `Body is the Interface`：人体先于数字、面板和技术状态获得注意力；避免满屏霓虹、扫描线、厚描边和常驻聊天栏。

- 视觉改动必须遵守 `docs/design/DESIGN.md` 第 7、10、19 节；复用 `src/design/tokens.json`、`IconButton` 与 `GlassCard` / `.glass-card`，执行 `npm run lint:design`，按固定视口实际审图。人体负荷使用设计第 7.3／7.4 节的 Neon 柔和桥接与 Graphite 冷暖中性色带，不得自行扩展多色热力或用 Unicode 代替工具图标。

## 当前路线图

本节是仓库唯一的推进路线图。后续 Agent 在开始实现前确认当前工作属于哪一项；完成一个阶段或改变顺序时，更新本节及对应专题文档，不再新增平行 roadmap 文档。

### 当前增量：Graphite 连续负荷色带

按用户要求直接实现 Graphite 冷灰蓝至暖沙色连续配色，五个中间色覆盖主题 load token，人体与刺激图例共用现有连续插值链路。保留无光晕、较低自发光、灰色零负荷、动作／焦点语义及训练数据契约；不新增独立色卡。设计契约见第 7.4 节，实际浏览器审图与验证见 `docs/design/VISUAL-REVIEW.md`；效果待用户审阅。

### 当前增量：柔和桥接人体配色与同源图例

用户已选定柔和桥接，Neon 首页／训练日负荷投影按 intensity 连续插值青、雾蓝、灰紫至洋红。五个中间色提升为共享 token，原色卡、人体与左下角“低刺激—高刺激”色带同源；零负荷／缺失保留灰色，动作主练／参与、焦点、Graphite、训练计算与数据保持原契约。色卡方向已确认，真实人体实施效果待审阅；设计与边界见第 7.3 节，验证见 `docs/design/VISUAL-REVIEW.md`。

### 当前增量：青至洋红渐变色卡提案

按用户要求先提供独立小色卡 demo：`/design-lab.html?study=gradient` 比较蓝紫桥接、柔和桥接和直接混色，支持滑杆连续预览与七阶取样。初版端点复用现有 Neon token，中间色仅为样板候选，未接入首页人体或修改训练计算／主题偏好。用户后续已选定柔和桥接，接入范围以上方“柔和桥接人体配色与同源图例”为准；其余方案仍只用于对照。范围见设计第 7.3 节，验证见 `docs/design/VISUAL-REVIEW.md`。

### 当前增量：肌肉焦点构图过渡

按用户要求在双语海报基础上增加桌面聚焦过渡：人体平滑左移并适度放大，四张事实 HUD 滑入画布右侧一列，海报留在原位。清除选择后镜头与卡片滑回，自转在回位后恢复；连续切换接续当前姿态，保留选中前镜头。小屏保持原布局，reduced-motion 直接呈现终态。规则见设计第 6.3.2 节，浏览器验证及限制见 `docs/design/VISUAL-REVIEW.md`。本轮为待用户审阅的交互版本。

### 当前增量：肌肉焦点背景大字

按用户确认的方向，单块肌肉焦点使用左侧两个 HUD 之间的低对比双行背景排版：首行中文，次行大写解剖名称配英文分区标记，紧密叠放、轻微错位并在右端渐隐；人体利用现有深度预绘制遮挡文字，完整名称保留在标题和档案。移除右下角选中名称列表，近似覆盖／专业映射信息移至图例附近；小屏隐藏装饰大字，四角事实 HUD 与对话入口保留。实现契约见设计第 6.3.1 节，审图与验证见 `docs/design/VISUAL-REVIEW.md`。当前为待用户审阅版本，未宣称真实 Mac 全部缩放档位验收。

### 当前增量：共享卡片通透度

按用户要求统一降低共享 GlassCard 的底色遮挡和背景模糊：默认层 48% 主题色混合／8px blur，quiet 层 34%／5px，HUD 展开层 58% glass-raised／8px。选中动作卡沿用共享透明底色再叠加焦点色，避免覆盖回厚重实底；两套主题、原位展开与可读性降级保留。参数统一维护在 `src/components/glass-card.css`，设计契约见第 10.0.1 节，审图记录见 `docs/design/VISUAL-REVIEW.md`；效果待用户审阅。

### 当前增量：首页 HUD 原位展开

按用户要求，Overview 四角摘要默认仅显示文字，背景透明且无边框；hover 时主文字保持原位，同一张共享 GlassCard 围绕摘要向画布内部扩展，将主文字和辅助详情包在同一连续底框内；不使用独立菜单／气泡式详情卡。保留键盘切换、Escape 与手机点按，其他模式沿用原卡片。规则见设计第 10.2 节，验证与审图见 `docs/design/VISUAL-REVIEW.md`。

### 当前增量：DSH 原生模型与思考强度设置

按用户要求在模型连接分区开放默认模型和思考强度，从当前 DSH Host 获取目录与能力，经认证 bridge 写入原生 `agent-default-model` 设置，不恢复 Fitness 独立模型配置或旧环境覆盖。适用于新对话与新建自动任务会话，已有会话保留原选择；支持重新读取、revision 冲突和只读反馈。真实安装 Host 的隔离 fixture 验证原生持久化、外部修改、旧／新会话边界与重启恢复；真实 DeepSeek 调用和生产部署仍未验收。详细契约见 DSH 集成文档，审图见 `docs/design/VISUAL-REVIEW.md`。

### 当前增量：设置页工作区重设计

按用户要求将四张折叠卡改为桌面左侧轻导航与右侧单一编辑区，手机使用顶部四项导航；沿用共享 GlassCard、IconButton 与两套主题 token。主题采用轻量布局示意预览；分区切换保留未保存输入，教练与自动计划继续独立保存，缺少密钥提示直达模型连接。模型连接区突出 DeepSeek Harness 原生支持，使用官方鲸鱼标识并提供简短介绍。实现规则见设计第 10.0.2 节，测试及审图见 `docs/design/VISUAL-REVIEW.md`。本轮为待用户审阅的视觉实现，不扩大为 Agent 主题同步或后端配置重构。

### 当前增量：身体旋转遮挡修复

按用户要求修复旋转时透明肌肉混色与大块明暗跳变：当前可见肌肉先写深度，再单次混合最近表面的颜色；保留皮肤轮廓、主题 token、负荷／动作／焦点透明度与拾取。原模型与数据契约不变。正反绘制顺序的受控 WebGL 对照确认面积性排序伪影已消除，几何交界仍可能有单像素差异；不宣称修复所有资产互穿或通过真机性能验收。规则见设计第 6.4 节，回归入口为 `tests/e2e/body-occlusion.spec.ts`，审图与检查记录见 `docs/design/VISUAL-REVIEW.md`。

### 当前增量：开源交付整理

按用户授权增加 Apache-2.0 源码许可，第三方人体模型保留原许可；清理 `pic/` 与 `docs/visual-regression/` 图片附件，审图默认输出到已忽略的 `test-results/`。构建与测试配置集中到 `tooling/`，根目录保留标准 HTML 入口，npm 命令和应用 URL 保持不变。目录、许可边界及本轮验证见技术架构及第三方资源说明；构建与静态检查通过，50 项单元／组件、23 项 E2E 通过，42 项集成覆盖通过（凭据恢复超时后独立复验通过）。Git 历史由用户另行清理，本轮不重写；跨来源写入问题按用户决定暂缓，不能将其记为已修复或据此宣称通过远程发布验收。

### 当前增量：独立工作区与新用户建档

本轮按用户授权完成数据分离、建档、迁移和自动化边界实现；代码、迁移与浏览器验证通过，真实模型写入因缺少 Key 尚未完成验收。验证和未验证边界见 [DATA-SEPARATION-VALIDATION.md](docs/engineering/DATA-SEPARATION-VALIDATION.md)。已接入边界：应用维护 `resources/fitness/`、模板和虚构案例；个人数据位于工作区 `fitness/`，普通设置位于 `config/settings.yaml`，会话、调度和建档草稿位于 `runtime/`。工作区 AGENTS.md 由初始化生成；DSH 只发现 AGENTS.md，每次请求读取当前档案与版本。首页按正式数据和可恢复草稿展示建档、继续、首份计划入口。专题契约见数据架构、[建档流程](docs/product/ONBOARDING.md)与 DSH 集成文档。生产拓扑和真实模型端到端证据单独记录，不能由静态检查推断。

### 当前增量：视觉方向与可替换主题

用户已批准三档青色与偏红洋红色卡。主站现已接入 Neon／Graphite 两套内置主题，CSS 与 Three 使用共享 token；仅设置页可切换主题；Neon 光效固定启用，Graphite 保留无霓虹参数。后台现已按“设置页工作区重设计”增量替换原四张展开卡片，教练和自动计划分别保存；DeepSeek 支持 Key 配置及 DSH 原生默认模型／思考强度选择，目录与能力由锁定版本 DSH 提供，Fitness 不另存一份模型偏好。工具图标、四角轻毛玻璃 HUD、手机空间层级同步收敛；维护门禁禁止已迁移 CSS 硬编码颜色。实施边界见 `docs/design/THEME-SYSTEM.md`，实际审图与验证见 `docs/design/VISUAL-REVIEW.md`。后续顺序：用户审阅主站效果 → Agent 主题同步 → 本地 JSON 主题包导入；后两项尚未实施，不默认建设布局／脚本插件平台。

### 当前增量：视觉一致性

按用户要求收敛 Calm Cyberpunk 风格：身体负荷投影采用青色阶与偏红洋红高负荷色，工具操作采用 Lucide 与共享 IconButton，CSS 和 3D 共用 token。维护规则与后续顺序见 `docs/design/DESIGN.md` 第 19 节，验证记录见 `docs/design/VISUAL-REVIEW.md`。保留身体探索、旋转及其他并行工作。

### 当前增量：身体探索与动态 HUD

身体选择改为 HUD 分区 → 肌肉两级导航，保留四角数据并随肌肉焦点切换。默认自转使用独立限频调度启动，选择期间暂停；取消播放按钮，reduced-motion 降低速度。Day／Exercise／肌肉焦点的四角 HUD 复用 GlassCard quiet 毛玻璃；首页现按“首页 HUD 原位展开”增量只常驻文字，hover／点按后整张玻璃卡片包住主文字与完整记录、口径或分布。组件状态与事实数据流见 `docs/data/MUSCLE-HISTORY.md`，视觉与运动行为见 `docs/design/DESIGN.md`，浏览器入口为 `tests/e2e/body-explorer.spec.ts`。

### 当前增量：身体训练档案第一步

按用户确认的顺序，先连接人体与真实历史，再提供相关动作探索。本增量的数据流、组数口径、模块所有权和验收入口见 `docs/data/MUSCLE-HISTORY.md`。实现与肌肉档案相关验证已完成；静态检查、34 项单元／组件、23 项集成、10 项相关 E2E 和全部 3D 校验通过。全量 E2E 另有并行会话历史对齐用例未通过，详见专题文档的验证记录。后续 Agent 上下文、实际完成反馈和进阶分析尚未实施，不与 DSH 发布 POC 混为一项。

### 当前优先级：DSH Surface 与统一 Host

DSH 已锁定升级至 `0.1.5-rc.2`：适配新版 main/rightbar、layout 导航与教练 prompt section；移除上游编译类名覆盖。按用户要求不建设旧对话／数据兼容层，以新 DSH 状态验收，个人训练 YAML 保留。真实 Host 无 Key 回归与验证边界见 DSH 集成文档；生产发布 POC 仍未完成。

历史对话已接入按需右侧毛玻璃轮盘，通过官方 Session 列表与选择恢复对话；入口合入官方会话标题行，圆点与轨道共用坐标，移除搜索框。导航消息仅用于 UI，不触发训练数据刷新。详细契约与验证边界见 DSH 集成文档。

本地交互、隔离副本 Agent 写入和文件校验链路已验证。当前已增加同源文件 revision 通知，
人或 Agent 修改数据后由 Fitness 校验再刷新页面；会话空闲不再作为数据刷新依据。
继续完善 Surface 与审批/重连体验，发布拓扑 POC 仍未完成；本地成功不等于生产验收。
跨电脑通过 Git 交付代码，真实数据、凭据与 runtime 不随功能提交混入。

首次密钥配置支持读取失败后的填写与保存重试，环境凭据仍只读；临时空工作区的真实 `npm run dev` 回归验证首次存储和刷新，不代表真实模型连通或用户机器上的读取失败根因已确认。验证入口与边界见 DSH 集成文档。

先完成三个可独立验证的 POC，再做任何大规模视觉或运行时替换：

1. **Fitness DSH Surface POC**：用自定义 DSH client shell/profile bundle 替换默认 DSH 应用壳；保留官方 Session、History、流式 Markdown、Tool、Approval、官方右侧预览和 reconnect；去除默认 logo、工作区树和设置入口，会话管理改为按需抽屉。
2. **同 Host 自动任务 POC**：由 DSH Host plugin 提供受保护的 loopback automation bridge；Fitness Scheduler 在同一个长期 DSH Host 创建/恢复 `fitness-daily-YYYY-MM-DD` Session。Scheduler 继续拥有 occurrence、claim、lease、retry 和 typed business outcome；不得模拟浏览器 cookie/Remote。
3. **发布拓扑 POC**：验证独立受控 Agent origin（推荐 `agent.fitness.example.com`）的 token/cookie、WebSocket、trusted-host、刷新和 reconnect；不采用把默认 DSH 挂在 Fitness `/agent/` path prefix 的做法，DSH 根 `/api` 与 `/api/remote.mux` 会和 Fitness API 冲突。

三项均通过后，按以下顺序推进：

4. 删除 SDK 自动 runtime 与默认 DSH 页面入口，收敛为一个长期 DSH Host；交互与自动任务共用 Host，但保持不同 Session 与幂等语义。
5. 接入最小事件桥：业务事件只允许 `fitness.agent.run-state` 与验证后的 `fitness.data-changed`；`fitness.history.*` 仅用于历史导航。禁止以 iframe load、Assistant 文本结束或任意 Tool call 触发 Dashboard 刷新。
6. 完成 Agent Surface 的视觉、移动端、键盘焦点、reduced-motion 和截图回归；对话展开只覆盖中央 Canvas。历史导航可按需覆盖 Training Rhythm，关闭后恢复；不替换 Timeline 或 3D Body。

## 执行与交付规则

- 先读取任务路由所列文档和相关现状代码，再提出或实现方案。发现现状与文档冲突时，先报告冲突，不能静默选一边。
- 改动遵循最小范围；保留其他人已存在的工作区改动与未跟踪文件，不做无关格式化、回滚或移动。
- UI 工作必须先阅读 `docs/design/DESIGN.md`，并以实际浏览器/截图验证视觉结果；代码通过不等于视觉达标。
- 数据、调度、DSH 或部署工作必须区分静态检查、聚焦测试、完整构建、真实 Host/浏览器验证和生产部署证据，不能互相替代。
- 新的长期设计决策写入上表对应目录；阶段完成、已证实约束或路线图优先级变化时，同时更新本文件的“当前路线图”。普通排查过程和未决想法放入 `docs/notes/`，不能提升为事实。
