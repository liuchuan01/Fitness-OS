# AI Fitness OS — Product & UI Design System v2

## 1. Product Principle

AI Fitness OS 是一个以身体为中心的训练控制系统。

核心原则：

> Body is the Interface.

用户不是在管理训练表格，而是在理解和控制自己的身体状态。训练记录、恢复程度、疲劳风险、动作刺激和未来计划都应投影到同一个 3D 人体上。

目标体验：

> 像控制机甲一样控制身体，但保持专业、安静、可信。

视觉方向：

- Biometric command canvas
- Premium minimal
- Tactical clarity
- Spatial data
- Calm futurism

参考气质：

- Iron Man / Jarvis 的身体控制感
- Apple Vision Pro 的空间层级与克制
- Cyberpunk 2077 的战术信息语言
- GitHub Contribution Graph 的历史密度表达

避免：

- 健身打卡 App
- Keep 式内容流
- 游戏装备面板
- 满屏霓虹、描边和扫描线
- 表格或指标卡主导页面
- 将内部 taxonomy、服务状态或调试信息直接暴露给用户

---

## 2. Experience Hierarchy

界面必须按以下顺序建立视觉注意力：

1. 当前身体状态
2. 需要关注的肌肉或风险
3. 当前模式和时间范围
4. AI 建议或下一步行动
5. 支撑判断的详细数据
6. 系统和模型状态

第一眼应看到人体。

第二眼应看到异常、高刺激或未恢复区域。

第三眼才看到解释和数字。

任何常驻 UI 如果与人体竞争视觉注意力，都应被弱化、折叠或按需显示。

---

## 3. Application Modes

产品不是一个静态 Dashboard，而是一组围绕身体切换的明确模式。

```text
Overview
  ├─ Day
  │   └─ Exercise
  ├─ Today Plan
  ├─ Muscle Focus
  └─ Generate Plan
```

### 3.1 Overview

回答：

- 我现在恢复得怎么样？
- 哪些部位值得关注？
- 今天适合训练什么？

人体显示当前恢复和近期训练负荷。

默认只展示：

- Readiness / Recovery
- 一个主要风险或洞察
- 一个推荐行动

不常驻展示完整肌肉列表。

### 3.2 Day

回答：

- 某一天练了什么？
- 训练刺激集中在哪里？
- 计划和实际完成情况如何？

人体切换为当日刺激投影。

详情面板展示：

- 时长
- 总组数
- 总训练量
- 主观疲劳或 RPE 摘要
- 动作列表

### 3.3 Exercise

回答：

- 这个动作主要刺激哪些肌肉？
- 哪些是主要、次要和稳定肌？
- 对当前身体状态是否合适？

人体只强调当前动作相关肌肉：

- Primary：最高视觉强度
- Secondary：中等视觉强度
- Stabilizer：低视觉强度
- Unrelated：降低透明度

动作详情使用面向用户的肌肉名称，不直接显示 canonical ID。

### 3.4 Muscle Focus

当前第一步：由人体单击或 HUD 两层部位选择器进入，在原日期／模式上增加肌肉焦点。

按顺序展示：最近涉及日期与最近主练日期 → 近 7 日主练／参与记录组 → 关联训练与每组参数 → 相关动作探索。历史默认最近 3 次，可展开全部；点击历史动作切换训练日并定位。相关动作已练优先，点击仅预览涉及肌肉，不自动生成训练计划。

普通模式显示自然语言名称和数据口径；近似覆盖在选中标签提示“模型近似显示”。模型 ID 与 coverage 技术标签仅专业模式可见。

桌面复用 Context Panel，手机复用最大 48dvh 的底部 Sheet。收起不清除选择；返回原视图清除肌肉焦点。文字选择入口在 WebGL 不可用时仍可用。

统计、状态和 API 的唯一详细契约见 [MUSCLE-HISTORY.md](../data/MUSCLE-HISTORY.md)。本阶段不显示真实恢复百分比或恢复倒计时。

### 3.5 Generate Plan

用户输入训练意图和约束，生成计划后直接投影到人体。

生成结果必须先回答：

- 为什么推荐这次训练？
- 目标肌肉是什么？
- 避开的风险是什么？
- 预计疲劳影响是什么？

### 3.6 Today Plan

由 Overview 的今日计划摘要或计划生成结果进入，回答：

- 今天按什么顺序训练？
- 每个动作具体做几组、多少重量或时长？
- 本次训练有哪些目标和注意事项？

Today Plan 是一个阅读优先的专注模式，不把完整计划继续塞在 Context Panel 中：

- Body Canvas 区域暂时切换为可滚动的计划文档，动作名称不得省略或单行截断。
- Context Panel 展示时长、动作数、计划组数、目标和预计刺激摘要。
- 顶部保留明确的“返回身体概览”和“复制今日计划”。
- 复制内容使用可直接粘贴到备忘录或聊天中的纯文本，并包含标题、日期、目标、分区、动作和每组参数。
- 复制成功或失败必须通过可访问的文本反馈表达，不能只改变图标或颜色。
- 进入和退出均保留 Overview 的日期与身体上下文，不创建新的计划生命周期状态。

---

## 4. Desktop Information Architecture

桌面端采用 Body Command Canvas，而不是固定三栏后台。

### 4.1 Default Layout

```text
┌────────┬──────────────────────────────────┬──────────────┐
│ Time   │                                  │ Context      │
│ Rail   │          3D Body Canvas          │ Panel        │
│        │                                  │              │
│ 64px   │          Primary focus           │ 280–340px    │
└────────┴──────────────────────────────────┴──────────────┘
```

#### Time Rail

- 默认宽度 56–72px。
- 用日期节点和强度表达训练历史。
- 展开后宽度 240–280px。
- 搜索只在展开状态出现。
- Timeline 是导航，不承担品牌介绍和大段洞察。

#### Body Canvas

- 始终占据最大可用区域。
- 人体本身获得至少 70% 的视觉注意力。
- 允许少量有明确指向关系的空间标注。
- 常驻信息保留四角轻毛玻璃 HUD（见第 10.2 节），平时仅显示名称与核心数值；不再叠加额外常驻指标卡。详情按需展开并加深玻璃底色，始终保持人体优先。
- 不使用大型装饰椭圆、扫描线或高对比网格抢占注意力。

#### Context Panel

- 宽度 280–340px。
- 内容随 Overview / Day / Exercise / Muscle Focus 切换。
- 默认展示结论，不展示全部原始数据。
- 可折叠为人体旁的 compact insight card。

历史对话导航是按需覆盖的例外：从会话标题行的操作区进入，在 Context Panel 上覆盖深色毛玻璃层，保持下方身体状态原位，不另起按钮顶栏。会话以弧形轮盘排列，中部向左内收、上下向右外退，文字保持水平；圆点中心沿可见轨道连续移动，不缩放或吸附跳动。显示标题与更新时间，支持滚动、键盘和点击恢复，不提供搜索框。关闭或切换成功后恢复身体状态区。手机改为右侧抽屉，弱化动效设置下不播放入场动画。

### 4.2 Top Bar

顶部只保留：

- 当前日期或时间范围
- 当前模式
- 视角控制入口
- 设置或专业模式入口

`Reset View`、`Clear Selection`、`Professional Mode` 不应以三个同权重按钮长期占据人体上方。

建议：

- Reset View：视角控制菜单中的次级操作
- Clear Selection：仅在存在选择时出现
- Professional Mode：全局设置或模式切换

### 4.3 Primary Action

每个模式最多一个主要行动：

- Overview：已有计划时 View Today’s Plan；没有计划时 Generate Today’s Workout
- Day：Review Workout
- Exercise：Add / Replace Exercise
- Muscle Focus：View Related Training
- Today Plan：Copy Today’s Plan

---

## 5. Mobile Information Architecture

移动端禁止简单地将桌面三栏纵向堆叠。

### 5.1 Structure

```text
┌──────────────────────┐
│ Mode / Date / Menu   │
│                      │
│     3D Body Canvas   │
│                      │
│  Primary insight     │
├──────────────────────┤
│ Draggable Bottom     │
│ Sheet                │
└──────────────────────┘
```

要求：

- 3D 人体保留在首屏主区域。
- Timeline 进入日历抽屉或底部 Sheet。
- Insights 与 Daily Workout 共用 Bottom Sheet。
- Sheet 支持 collapsed、half、expanded 三档。
- 切换日期或动作时，人体不离开用户视线。
- 不在移动端常驻完整肌肉列表。

首屏高度目标：

- 3D Canvas：55–68vh
- Compact Insight：一条主要结论
- Bottom Sheet Handle：始终可见

---

## 6. 3D Body Visualization

人体模型是唯一视觉核心。

### 6.1 Asset Contract

当前模型和 UI 使用 67 个 canonical 二级肌肉 ID。

要求：

- 使用轻量 Web 3D 模型。
- 四肢完整。
- 只显示皮肤层和训练相关肌肉层。
- 不显示骨骼、内脏、生殖器。
- 肌肉高亮绑定 canonical muscle ID。
- 计算层、API、模型契约和交互层使用同一套 ID。

### 6.2 Coverage Semantics

- `exact`：模型存在准确可交互网格，可点击和高亮。
- `partial`：模型只能表达部分区域，可高亮但不能暗示完全准确。
- `missing`：不在模型上伪造投影，通过文本说明。

普通用户界面不直接显示 coverage 标签。

当 coverage 为 `partial` 时，在肌肉详情中使用自然语言：

> 当前模型仅能近似显示该肌肉区域。

专业模式可以显示 canonical ID、coverage 和模型绑定信息。

### 6.3 Camera

- 默认视角根据当前重点自动选择正面、背面或侧面。
- 默认缓慢自动巡览；拖动期间暂停、松手后继续。打开部位探索或聚焦肌肉时暂停，退出探索且没有焦点后继续；后台页面停止调度。按用户明确要求，reduced-motion 下保留更慢的自转，不再禁止启动；不提供播放／暂停按钮。
- 当前采用按需 Canvas + 最高 24 Hz 运动调度、DPR 上限 1.25；不以永久停止旋转解决渲染开销。
- 选择背部动作时优先平滑转向后侧。
- Reset 恢复当前模式的推荐视角，而不是固定机械归零。
- 移动端确保头、手、脚不被工具栏或 Sheet 遮挡。

当前动作预览通过独立 `exerciseTargets` 渲染主练／参与颜色，不修改领域 intensity，选中标签不显示刺激分数。

部位选择采用深色玻璃 HUD：先展示 9 个身体分区，再展示分区内的肌肉。悬停／键盘聚焦分区预览人体高亮，选择具体肌肉后进入历史档案。面板限制在视口内并内部滚动。人体周围四个 HUD 在肌肉焦点中继续显示，内容切换为最近训练、近 7 日次数、主练／参与组和最近关联动作；与右侧详情共用事实查询。

### 6.4 Visual Layers

- Skin：低透明度、低对比度。
- Inactive muscle：可辨认但不抢注意力。
- Active muscle：通过颜色、发光和轻微脉冲表达。
- Selected muscle：轮廓、亮度和空间标注同时加强。
- Unrelated muscle：在 Exercise 模式进一步降低透明度。

禁止通过放大网格造成明显的肌肉形变。

---

## 7. Muscle Color Semantics

### 7.1 Neon 三阶配色 · 已确认并接入主站

用户已确认整体方向及以下六色色卡。本轮将 Neon 与 Graphite 接入主站：仅在配置后台切换主题并保存偏好，DOM 与真实人体共同消费主题值。色卡批准不等于主站全部标准场景已获视觉批准。样板入口仍为 `/design-lab.html`，实现边界见 [THEME-SYSTEM.md](THEME-SYSTEM.md)。

| 色阶角色 | 青色 `cyan` | 偏红洋红 `magenta` | 推荐用途 |
| --- | --- | --- | --- |
| 强调 `strong` | `#00E5FF` | `#FF477E` | 主行动、重点肌肉、当前焦点 |
| 中等饱和 `medium` | `#57B8C3` | `#CB718C` | 参与部位、次级信号、普通强调 |
| 低饱和 `muted` | `#789DA2` | `#AA8792` | 弱提示、低强度信息、安静的辅助标记 |

三档是降低饱和度并配合明度校正得到的独立、不透明色值，不是对同一颜色设置三个 alpha。Neon 唯一实现来源为 `src/design/tokens.json`；`theme-definitions.ts` 派生 `neonScales`，样板复用它，不另抄六色色值。Graphite 使用 `src/design/graphite.json`。

**稳定语义：** 青色用于通用交互及动作主练；偏红洋红用于当前焦点及动作参与。模式标题、肌肉名称与图例必须同步。色阶降低不改变角色，不能把低饱和误称为禁用、恢复不足或不同训练强度；训练强度另有领域定义。首页负荷模式使用中／强洋红表达较高估算负荷；洋红不表示错误或医学危险，模式标题和图例区分负荷与焦点。警示反馈沿用独立语义。

**色彩与光效分离：**

- 色阶控制基础颜色；透明度控制前后关系；自发光与光晕控制光感，三者不互相代替。
- 正文与普通卡片无常驻光晕；主行动和焦点允许局部发光。强／中／低三个色阶均要在无光晕时可辨认。
- 控件光晕的颜色来自主题 token；主站当前使用 16px 内层与 36px 弱扩散层，仅用于焦点和主行动，不能所有元素同时使用。样板的 18px／44px 仍用于独立比较，不是所有产品控件的固定尺寸。
- 主站不提供光效开关：Neon 固定启用 token 定义的局部控件光晕和重点肌肉自发光；旧浏览器关闭光效的偏好自动归一为启用。Graphite 仍使用自身无光晕与低自发光参数。样板保留独立开关用于比较，主站未启用屏幕空间 Bloom。
- 六色同时展示仅用于设计比较。产品中的多档色阶须依据主次关系使用，不做六种肌肉状态的彩虹图。
- Graphite 保留独立的中性配色与无光晕表现；切换主题不清除预览模式，切回 Neon 恢复默认光效。

**审阅入口：** 样板同时展示六个色卡、同色文字、按钮与真实人体材质。分别比较两组色阶，关闭控件光晕与材质自发光后再次检查；包含桌面 1440×1000 和手机 390×844。低饱和色也必须按文字／控件实际背景验证对比度，不能用颜色名称推断可读性。截图仍标为待确认，不自动升级为最终基线。

### 7.2 主站身体语义与主题适配

颜色由 `theme-definitions.ts` 汇总；`ThemeProvider` 向主站组件和 Three 场景传入同一个主题。CSS 由 `npm run design:tokens` 从两套 JSON 生成，业务组件不按主题 ID 分支。API 的历史 status 名称不是颜色指令，不改变估算公式。

| 身体语义 | Neon 当前映射 | Token | 表达 |
| --- | --- | --- | --- |
| 无数据 / 低关注 | 冷灰 `#536878` | `gray` | 保留身体轮廓 |
| 轻刺激 | 低饱和青 `#789DA2` | `blue` | 低视觉强度 |
| 有效刺激 | 中饱和青 `#57B8C3` | `orange` | 与动作主练独立 |
| 高刺激 / 高累计估算负荷 | 中／强洋红 `#CB718C` / `#FF477E` | `red` / `purple` | 由文字说明估算口径 |
| 动作主练 | 强调青 `#00E5FF` | `accent` | 独立动作预览，不表示刺激评分 |
| 动作参与 | 中饱和洋红 `#CB718C` | `selection-mid` | 次级参与角色 |
| 选中 / 部位探索 | 偏红洋红 `#FF477E` | `selection` | 当前焦点，附名称与档案 |

- 动作、选中、分区探索优先于历史负荷投影，非焦点肌肉弱化但保留可辨轮廓；不放大肌肉网格。
- 动作预览叠加肌肉焦点时，图例同时提供主练、参与与焦点说明，保留“非刺激评分”。图例用角色与同源色点，不把“青色／洋红”写死为跨主题标签。
- Graphite 使用中性暗色、无控件霓虹及较低基础自发光，保持相同产品语义、选中肌肉、日期与模式。
- 首页负荷投影统一青／洋红色阶，禁止再用琥珀给人体高负荷着色。成功／错误／警示颜色仅用于相应反馈；负荷色不代表真实恢复或医学风险。
- 本轮只提供内置主题，未实现外部 JSON 导入、任意 CSS／JS 插件或 Agent iframe 主题同步。

---

## 8. Surface and Background

### Base Colors（默认 Neon；Graphite 由主题覆盖）

```text
Canvas Primary   #070912
Surface          #111422
Surface Raised   #1B2032
Text Primary     #F1F5FF
Text Secondary   #A4AFC5
Border Subtle    rgba(164, 175, 197, 0.16)
Accent Cyan      #00E5FF
Focus Magenta    #FF477E
```

### Surface Rules

- 大面积区域依靠层级和留白分隔，不依赖高亮描边。
- 卡片统一使用 `GlassCard` / `.glass-card` 材质：半透明主题底色、背景模糊、细边界与淡色边缘流光。禁止每个功能重新定义一套玻璃。
- HUD 使用 quiet 层级；后台与内容卡沿用同一材质。全页容器、表格行和卡片内控件不重复叠加模糊。
- 扩散发光只用于选中肌肉、主要行动和异常状态；卡片边缘允许统一的淡色流光，不铺满表面。
- 页面背景可以有低对比度空间渐变。
- 全局扫描线、重复网格和装饰切角默认禁用。

---

## 9. Typography

### Font Families

- Display / Title：Space Grotesk 或 Inter Tight
- Body：Inter
- Numeric / Biometric：JetBrains Mono

必须实际加载字体；未加载时使用明确的系统 fallback。

### Type Scale

| Role        | Desktop |  Mobile |
| ----------- | ------: | ------: |
| Hero metric | 40–56px | 32–40px |
| Page title  | 28–36px | 24–30px |
| Panel title | 18–22px | 18–20px |
| Body        | 14–16px | 14–16px |
| Label       | 11–12px | 11–12px |
| Biometric   | 13–16px | 13–15px |

规则：

- 等宽字体只用于数字、时间、ID 和短状态。
- 长段正文和动作名称不使用等宽字体。
- 不在同一信息层级混用中文名称、英文自然语言和 canonical ID。
- 产品界面以中文为主时，英文只作为稳定的模式标签或品牌语言。

---

## 10. Component Rules

### 10.0 工具按钮与图标

- 唯一新增图标库为 `lucide-react`；默认 18px、1.75px 线宽、currentColor。禁止用 Unicode、emoji 或混合图标库替代工具图标。
- 重置、关闭、清除、暂停、设置等工具动作使用 `src/components/IconButton.tsx`，统一 44×44px 触控区域、focus-visible、aria-label 和 title。
- 开关提供 aria-pressed；展开入口提供 aria-expanded。SVG 对读屏隐藏，按钮中文名称必须保留。
- 图标减少工具栏噪声，不删除关键产品信息：生成计划、查看计划、身体探索、训练动作等不够自明的入口保留简短中文。不得为了“科技感”把整页改成英文。
- 原生 title 是本轮桌面提示；移动端不能依赖 hover 才理解关键动作。复杂说明使用可访问浮层，不塞进图标。

### 10.0.1 共享毛玻璃材质

唯一实现为 `src/components/GlassCard.tsx` 与 `glass-card.css`。组件只管理材质，不决定业务、尺寸或定位；默认 div，可用 `as="section"` 等语义标签。需要原生 button / details 或 ref 的已有容器直接使用 `.glass-card`，避免额外包裹破坏点击、键盘和浮层定位。

- 默认层：主题 glass 的 72% 混合透明度，20px blur，细边界和低强度青／洋红渐变。quiet 层用于四角 HUD，52% 混合透明度、12px blur、无扩散阴影；展开时改为更深的 glass-raised。
- 边缘装饰局限于 1px 遮罩，不覆盖内容、不接收指针。静止时保留淡色光边；hover、focus-within、details 展开或 HUD 展开时 18 秒缓慢绕行。reduced-motion 停止流光，Graphite 采用静态中性弱边缘。
- 后台设置、新用户建档、密钥提示、身体探索、四角 HUD、计划／动作卡、选中标签、状态通知和历史抽屉复用此材质。禁止再用不透明实色卡作为默认替代。
- 例外：页面布局容器与计划文档保持开放排版，列表行／组次／表单控件保持平面，避免玻璃套玻璃；原生 Agent iframe 内部由官方 Surface 管理，主站不以 CSS 穿透替换。聊天全画布遮罩负责背景退场，不额外套成小卡。
- 不支持 backdrop-filter 时退回可读的主题深色底。卡片自身颜色与边缘必须来自主题 token；新增卡片复用此规则，例外在评审记录说明理由。

### 10.1 Insight Card

一张卡只回答一个问题：

- 当前状态是什么？
- 为什么？
- 下一步做什么？

推荐结构：

```text
下背部
最近涉及训练 · 3 天前
查看历史动作与组数
```

### 10.2 Metric

关键指标使用“大数值 + 短解释”，避免连续堆叠同尺寸卡片。

四角 HUD 默认采用统一 quiet 毛玻璃、淡边缘和无扩散阴影，显示名称和核心数值。展开后沿用同一材质并加深底色、增加宽度与真实内容，移出恢复精简态。键盘 Enter／空格与手机点按可切换，Escape 收起。这取代早期精简态完全透明的要求。

| HUD | 默认摘要 | 展开内容 |
| --- | --- | --- |
| 距上次训练 | 间隔天数 | 最近日期、训练名称、全部分区记录组数；不把间隔解释为恢复程度 |
| 近 7 日训练 | 次数 | 已记录时长、最近三次历史记录的日期与名称，明确区分七日统计与历史列表 |
| 力量训练 | 力量记录组 | 平均 RPE、时间范围、组筛选规则与缺失值口径 |
| 肌群训练分布 | 第一项肌群及折算组 | 完整肌群列表、相对比例条、主练／参与折算口径 |

展开内容限制高度、内部滚动，不新增查询或训练统计。`OverviewHud` 组织现有 dashboard 投影；`HudCard` 仅负责展开交互；肌肉焦点仍共用页面持有的历史响应。

首页只常驻四类可解释数据：距上次训练、近 7 日训练次数与时长、力量训练组数与平均 RPE、肌群折算组。跨动作公斤数和未填写的 readiness 不作为首页指标。

### 10.3 Muscle List

默认不展示全部 67 项。

允许的列表：

- 当前异常肌肉
- 当前动作相关肌肉
- 用户搜索结果
- 专业模式下的完整列表

列表应按语义分组和排序，不按内部 ID 顺序平铺。

### 10.4 Exercise Card

默认展示：

- 动作名
- 完成组数
- 重量 × 次数
- RPE
- Primary / Secondary 的自然语言摘要

不直接显示：

- `latissimus_dorsi`
- `biceps_long_head`
- `coverage: exact`

这些信息仅在专业详情中展示。

### 10.5 System Status

`Local Service 0.0.0`、模型网格数、加载契约等属于开发或诊断信息。

正常状态不常驻展示。

只有异常时显示面向用户的错误和恢复操作。

### 10.6 Today Plan Summary and Detail

Overview 中的今日计划只承担入口与摘要职责：

- 标题、预计时长、动作总数。
- 最多预览前三个动作，其余使用“另有 N 个动作”表达。
- 使用整卡可识别的“查看完整计划”操作进入 Today Plan。

Today Plan 详情按“计划抬头 → 训练提示 → 训练分区 → 动作 → 每组参数”组织：

- 分区使用稳定序号帮助用户在训练中快速定位。
- 动作名允许自然换行，不使用省略号隐藏关键信息。
- 每一组单独展示重量、次数、时长、自重系数和 RPE；缺失值不伪造。
- 桌面端动作信息与组次信息可并排，移动端改为纵向排列。
- 复制按钮在详情顶部保持可见，避免用户滚动到底部才能操作。

---

### 10.7 配置后台卡片

配置属于独立的管理场景。桌面两列、手机单列；每张卡片复用统一毛玻璃、弱边界、圆角和 Lucide 线性图标，普通卡片无扩散霓虹。标题、当前状态与简短用途始终可见，点击标题或键盘 Enter／Space 展开原生 details，表单按需出现。

- 当前五个入口：DeepSeek、界面外观、训练记录导入、教练指令、自动计划。默认均收起；训练记录导入只在后台按需展开，不与首页人体争夺视觉注意力。摘要展示各项用途或连接状态，不并列堆放提供商、模型名称和密钥三个配置层。
- 训练记录导入使用原生文件选择、明确的导入／重复跳过数量和可恢复错误；只展示原始计数与时长，不为摄像头记录补写重量、RPE 或肌肉刺激。
- 外观只在后台呈现，首页顶部只保留配置入口；Neon 光效为主题固定行为，无独立开关。
- 教练指令和自动计划各自保存，保存一张卡不能提交或清空另一张卡的草稿。密钥不回显，保存成功清空输入；错误保留可重试入口。
- 卡片摘要触控区至少 44px，支持焦点描边；320px 下时间与时区改为单列，不横向溢出。
- 正文使用简短中文说明用户可控制的结果，不把 system prompt、provider route 等内部配置术语放入操作流程。

---

## 11. Interaction

### Pointer

- Hover：肌肉轻微发光，并显示名称。
- Click：选择并聚焦单个肌肉。
- 当前第一步采用单选，点击直接进入 Muscle Focus；多选暂不启用。
- Click Empty Canvas：清除临时焦点。
- Drag：旋转人体。
- Wheel / Pinch：缩放。

普通 Click 不应在没有提示的情况下无限累积多选。

### Touch

- Tap：选择肌肉并展开训练档案。
- Drag：旋转人体。
- Pinch：缩放。
- Swipe Sheet：展开或收起信息。

触控目标最小 44 × 44px。

### Selection Feedback

选中后同时提供：

- 肌肉高亮
- 名称标注
- Context Panel / Bottom Sheet 更新
- 可明确撤销的状态

---

## 12. Motion

运动服务于状态变化和空间关系，不作为持续装饰。

### Timing

- Hover / Press：120–180ms
- Panel / Sheet：200–300ms
- Camera transition：350–550ms
- AI projection reveal：600–1200ms

### Principles

- 使用 spring 或自然 ease-out。
- 相机旋转有惯性，但必须可立即接管。
- 当前重点肌肉允许低频呼吸式脉冲。
- 非重点肌肉不持续闪烁。
- 恢复变化可使用缓慢流动渐变。
- 尊重 `prefers-reduced-motion`。

---

## 13. AI Generation Experience

点击 Generate 后，人体仍保持可见。

生成过程以单一空间层表达，不弹出多层模态框。

状态：

1. Reading training history
2. Estimating recovery
3. Resolving constraints
4. Building workout
5. Projecting stimulus

完成后：

- Overlay 淡出。
- 人体按 Primary → Secondary → Stabilizer 顺序点亮。
- Context Panel 展示训练逻辑。
- 主操作切换为 Accept Plan。

不显示伪精确的百分比进度。

---

## 14. Empty, Loading and Error States

### Empty

人体保持完整、半透明，不显示空白画布。

```text
Your body has no training history yet.
完成第一次训练，建立你的身体基线。
```

主操作：

`Build First Workout`

### Loading

- 优先显示人体轮廓或低精度占位。
- 避免中央长期空白。
- 模型加载状态不作为永久 HUD。

### Error

错误信息必须包含：

- 发生了什么
- 哪部分仍然可用
- 用户可以采取什么操作

WebGL 不可用时，回退到二维人体或结构化肌肉摘要，而不是只提示技术错误。

---

## 15. Accessibility

- 文本和背景满足 WCAG AA 对比度。
- 所有颜色状态有文本或图形冗余。
- 3D 交互必须有键盘和列表替代路径。
- 焦点样式清晰，不只依赖发光。
- 支持 reduced motion。
- Canvas 提供当前模式和选中状态的可访问描述。
- 专业术语提供中文名称或解释。

---

## 16. Responsive Breakpoints

```text
Large Desktop  ≥ 1440px
Desktop        1100–1439px
Tablet         768–1099px
Mobile         < 768px
```

### Large Desktop

窄 Time Rail + 大 Body Canvas + Context Panel。

### Desktop

Context Panel 可覆盖在 Canvas 右侧；Timeline 默认折叠。

### Tablet

人体全宽；Timeline 和 Context 使用抽屉。

### Mobile

人体 + Bottom Sheet，不使用纵向三栏堆叠。

---

## 17. Design Acceptance Criteria

每次 UI 迭代至少验证：

### Visual Hierarchy

- 3 秒内能识别当前身体重点。
- 人体是第一视觉焦点。
- 页面不存在多个同权重主操作。

### Product Clarity

- 用户能判断当前处于 Overview、Day、Exercise 或 Muscle Focus。
- 用户能理解人体颜色代表什么时间范围和状态。
- 用户不需要理解 canonical ID。

### Desktop

- 3D 人体不被左右区域挤压。
- 常驻浮层不遮挡重点肌肉。
- 67 肌肉数据不会以完整长列表默认展示。

### Mobile

- 人体保持首屏可见。
- Timeline 和详情不会形成桌面面板的简单纵向堆叠。
- 切换日期、动作和肌肉时无需离开人体上下文。

### 3D

- 模型显示完整。
- 67 个 canonical 肌肉映射与计算结果一致。
- `exact` 可交互。
- `partial` 不冒充精确覆盖。
- 动作选择能投影 Primary、Secondary 和 Stabilizer。

---

## 18. Current Redesign Priorities

1. 建立 Overview / Day / Exercise / Muscle Focus 的明确模式。
2. 将桌面三栏后台改为 Time Rail + Body Canvas + Context Panel。
3. 移除默认完整 67 肌肉列表，改为上下文相关摘要。
4. 将 canonical ID 和 coverage 信息移入专业模式。
5. 将移动端改为 3D Body + Bottom Sheet。
6. 减少全局描边、发光、网格和扫描线。
7. 使用训练间隔、训练节奏、力量组数和肌群折算组替代含义不清的 Load、Weekly Volume。
8. 将开发状态和模型状态从普通产品界面移除。
9. 完善视角聚焦、多选语义和 Muscle Focus。
10. 最后再增加 AI 生成动画和高级 HUD 细节。


## 19. 持续视觉维护

每次 UI 修改以本文件为视觉事实来源。先说明影响哪个模式、视觉主次和色彩语义，再实现；不要逐页自行发明主题。

### 交付门槛

1. 优先复用 token 和 IconButton；新增 token 必须说明语义和复用位置。修改 token 后运行 `npm run design:tokens`，`npm run lint:design` 检查 CSS 与 3D 来源一致，已接入 validate。
2. 不凭编译通过判断“好看”。使用固定数据、固定日期、暂停旋转，在桌面 1440×900、手机 390×844 检查 Overview、Day、Exercise、Muscle Focus；另查选择器、键盘焦点、空态和 reduced motion。
3. 3D 模型加载完成后再截图。检查人体完整、图标点击区、浮层遮挡、提示与图例口径；不能用空 Canvas 或服务报错图作为视觉基线。
4. 本轮截图和验证结果记录在 `docs/design/VISUAL-REVIEW.md`。自动截图更新不能代替人工审图，差异须说明原因；未来有稳定渲染环境后再启用像素差异阈值。
5. `lint:design` 检查 token 同步、Graphite 未知覆盖键及已迁移主站 CSS 的 hex／rgb／hsl 硬编码颜色；新增功能样式须加入脚本覆盖范围。它不自动证明布局、对比度或整个仓库合规；实际审图仍为交付门槛。

### 开源资源采用原则

- [Lucide](https://lucide.dev/)：已采用的线性 SVG 图标，可统一尺寸、颜色和线宽；授权见 [官方 LICENSE](https://github.com/lucide-icons/lucide/blob/main/LICENSE)。通过包依赖保留许可，不复制不明来源图标。
- [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction)：后续复杂 Dialog / Tooltip 的无样式交互基础候选；其键盘、焦点与语义能力可复用，外观仍由本项目 token 控制。本轮未增加该依赖。
- 不直接套用 cyberpunk dashboard 模板、HUD 特效包或完整组件主题；这些资源容易引入多重高亮、额外字体和与人体竞争的卡片。

### 后续收敛顺序

主站已接入两套内置主题和共享 token，继续以标准场景审图决定后续调整。实施优先级统一维护在 `AGENTS.md`；Agent iframe 同步与外部主题包仍为后续边界，不另建平行路线图。
