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

### 当前增量：设置模块职责归位

按用户授权将设置工作区从 features/automation 收拢到 features/settings，应用入口改为 SettingsPage；外观、教练、自动计划、模型连接各自归位。页面继续拥有教练／调度草稿和保存动作，两个受控表单只渲染；模型连接保持独立状态。路由、分区切换保留草稿、独立保存与主题表现维持原契约。目录与所有权见技术架构第 14 节。静态检查、58 项单元／组件、完整 build 与 6 项设置页 E2E 通过，桌面／手机设置已实际审图；并行人体／HUD 改动不属于本提交。

### 当前增量：无用代码清理与模块边界审查

按用户要求移除独立 design-lab、主题／渐变提案及专用 3D 预览、旧 3d-muscles/viewer.html 和测试；正式主题、连续色带、设置页示意与主站测试保留。清理未调用的前端 API 封装和 zustand 直接依赖，将 HTTP JSON／静态资源响应提取至 server/http。当前结构适合维持单服务与前端 feature 划分；数据读写、Scheduler 时间计算／审计及设置目录归属的拆分建议见技术架构第 13 节，尚未实施。静态检查、58 项单元／组件、45 项集成和构建通过；20 项 E2E 覆盖通过（含失败单项复验），全量浏览器验证因并行 UI 改动中断，详见技术架构第 13 节。不扩大为删除迁移工具、测试 fixture 或个人数据。

### 当前增量：窗口化聚焦与肌肉 HUD 详情

按实际画布空间统一海报、镜头和右侧 HUD 的聚焦门槛；非全屏窗口采用较小海报、1.12 倍放大和紧凑四卡，不强制关闭侧栏。四卡 hover 展示现有档案中的最近训练、七日记录、组数来源与逐组参数，复用现有数据与格式化，不新增查询。契约见设计第 6.3.1、6.3.2、10.2 节及肌肉历史文档，验证见 VISUAL-REVIEW。

## 执行与交付规则

- 先读取任务路由所列文档和相关现状代码，再提出或实现方案。发现现状与文档冲突时，先报告冲突，不能静默选一边。
- 改动遵循最小范围；保留其他人已存在的工作区改动与未跟踪文件，不做无关格式化、回滚或移动。
- UI 工作必须先阅读 `docs/design/DESIGN.md`，并以实际浏览器/截图验证视觉结果；代码通过不等于视觉达标。
- 数据、调度、DSH 或部署工作必须区分静态检查、聚焦测试、完整构建、真实 Host/浏览器验证和生产部署证据，不能互相替代。
- 新的长期设计决策写入上表对应目录；阶段完成、已证实约束或路线图优先级变化时，同时更新本文件的“当前路线图”。普通排查过程和未决想法放入 `docs/notes/`，不能提升为事实。
