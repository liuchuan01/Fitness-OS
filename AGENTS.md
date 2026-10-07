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

- 视觉改动必须遵守 `docs/design/DESIGN.md` 第 7、10、19 节；复用 `resources/themes/` 主题包及 `src/design` 适配器、`IconButton` 与 `GlassCard` / `.glass-card`，执行 `npm run lint:design`，按固定视口实际审图。人体负荷使用设计第 7.3／7.4 节的 Neon 柔和桥接与 Graphite 冷暖中性色带；Orbital 使用第 7.5 节青蓝连续色带，不得自行扩展多色热力或用 Unicode 代替工具图标。

## 当前路线图

### 当前增量：文件解析设置页收敛

按用户反馈将 TextIn 介绍收敛为一句话与官方链接，启用/付费选项统一为右侧开关；未启用时禁用付费开关，关闭启用同步取消付费草稿，两个开关均开启才展开凭据表单。沿用独立保存与原凭据存储，收起保留输入和已有凭据；统一刷新图标、表单间距和主题层级。契约见 DESIGN 第 10 节与技术架构第 16 节。静态门禁、73 项单元/组件、完整 build 和 10 项设置页 E2E 通过；三主题桌面/手机的关闭、仅启用和凭据展开状态已截图，实际审图记录见 VISUAL-REVIEW。


### 当前增量：可选 TextIn 文件解析与历史记录迁移

按用户授权将 xparse-cli@2.5.0 纳入运行时依赖，设置工作区新增“文件解析”，独立配置启用/付费许可及 TextIn App ID / Secret Code。凭据沿用 DSH 原生存储；原生 Skill provider 与受控 CLI 工具按开关发现、加载和执行，下一条消息生效，关闭保留凭据。项目适配技能固定上游快照并补充 Fitness 迁移边界，新增独立历史 workout 导入命令，归档来源、确定性计算并拒绝覆盖已有日期。契约见 DSH 集成文档与数据架构，技术架构第 16 节记录模块职责。静态检查、72 项单元/组件、完整 build、57 项集成唯一用例及 7 项相关 E2E 覆盖通过（包含独立复验；不是全量一次通过），三主题桌面/手机配置页已实际审图，见 VISUAL-REVIEW。真实 TextIn 云端、真实模型迁移、OAuth、多租户及生产部署未验收；Shell guard 不替代操作系统沙箱，历史会话知识不因关闭而清除。


### 当前增量：Orbital 亮色座舱与主题审查修复

按用户提供的高达 00 驾驶舱截图新增第三套内置主题 Orbital / 轨道座舱：白灰画布、石墨文字、青蓝连续负荷色带、浅色玻璃与独立人体白光。协议兼容增加 light 和可选 lightColor，保留人体优先、既有布局与训练语义。修复 FIFO 阻塞主题扫描和字体预载期间无法重选当前主题取消的问题，加入回归测试。作者契约、视觉规则和工程边界分别见 THEME-PACK-AUTHORING、DESIGN 第 7.5 节与技术架构 15.1；静态检查、66 项单元／组件、54 项集成覆盖（凭据恢复超时后独立复验通过）、完整 build、三项 3D 校验和 10 项相关 E2E 通过；Orbital 桌面／手机四模式已实际审图，见 VISUAL-REVIEW。


### 当前增量：目录安装主题包

按用户授权推进声明式主题包：内置 Neon／Graphite 与 `<WORKSPACE_ROOT>/themes/<id>/theme.json` 使用同一校验协议，刷新目录即可发现，不依赖重新构建或重启服务。外观配置包括语义颜色、字体预设与本地 WOFF2、玻璃材质、有限动效和人体材质／灯光；布局、训练语义、模型映射和可访问行为仍由产品拥有。作者契约见 `docs/design/THEME-PACK-AUTHORING.md`，工程边界见技术架构第 15 节。Agent iframe 同步与亮色主题未纳入本增量。静态检查、65 项单元／组件、52 项集成、完整 build、三项 3D 资源校验及 27 项相关 E2E 通过；三主题四模式的桌面／手机已实际审图，记录见 VISUAL-REVIEW。

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
