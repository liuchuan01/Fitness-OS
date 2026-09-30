# 视觉收敛审阅记录

2026-09-14 开源清理：按用户要求删除历史截图附件，以下审阅结论保留为历史记录，旧路径不再提供图片。新截图通过测试或 `npm run design:review` 生成至已忽略的 `test-results/visual-regression/`，不提交个人界面截图。

日期：2026-09-13。对应 DESIGN.md 第 7、10、19 节。

## 本轮决策与实现

- 保留 Body is the Interface，方向收敛为 Calm Cyberpunk：石墨黑、冷青色阶、琥珀高负荷。原多色 status 名称仅保留 API 兼容意义。
- `src/design/tokens.json` 是本轮身体材质与状态圆点的颜色来源，`tokens.css` 由脚本生成。选中使用冰青，其余肌肉退暗；动作预览主练亮青、参与暗青。
- 顶部设置与日历、身体重置／清除／专业模式、选择器关闭采用共享 IconButton。探索身体保留文字；图标并非替代所有中文内容。
- 工具图标使用 Lucide，统一 44px 点击区、18px 图标、1.75px 线宽、中文可访问名称、title 和键盘焦点。复杂浮层候选为 Radix，本轮未引入。
- 修复缺失的 body-viewer.css、并行改动中的重复 import 和训练分布重复可访问名称。为手机底部输入区增加相机留白，短 Canvas 保持原中心，避免头部被工具栏遮挡。
- 保留工作区已有身体探索、自动旋转、HUD、会话等改动；不把这些全部计作本轮新增功能。

## 可重复审图

先 `npm run build`。分别启动 `DATA_ROOT=tests/fixtures/data npm run start:service` 和 `npm run dev:web`，再执行 `npm run design:review`。

审图脚本调用编译后的实际 projection 计算，读取 fixture YAML 并固定概览日期为 2026-06-21，在浏览器中覆盖只读 dashboard 响应；其余查询仍走 fixture 服务。不会写入真实训练数据。不能连接真实数据服务后把结果称为固定基线。

视口为桌面 1440×900、手机 390×844，reduced motion 开启，等待模型和肌肉档案数据加载。审图脚本通过浏览器内的后台可见性事件暂停自转并重置视角，不改变生产运动逻辑。当时生成路径为 `docs/visual-regression/style-review/`，含 Overview、HUD 展开、Explorer、Muscle Focus、Exercise preview、Day 及四个 HUD 的展开内容；可用 `VISUAL_OUTPUT` 指定本轮证据目录。

已审阅 桌面概览（历史截图路径：`../visual-regression/style-review/desktop-overview.png`，附件已移除）、手机概览（历史截图路径：`../visual-regression/style-review/mobile-overview.png`，附件已移除）、手机选择器（历史截图路径：`../visual-regression/style-review/mobile-explorer.png`，附件已移除）、桌面／手机焦点与动作预览。日训练交互由 app E2E 及其截图覆盖。

审图确认身体色彩收敛、工具栏文字噪声减少、选择有名称反馈、手机选择器未超出视口。截图是审阅材料，不是已启用的像素差异测试。

## 验证与边界

- lint、架构检查、token 一致性检查、typecheck、生产构建通过。
- 单元／组件测试 37 项通过。全部 3D contract、source-map、runtime 校验通过。
- 相关 E2E 覆盖 app、muscle-history、body-explorer，共 12 项通过（单 worker）。早期并行编辑造成重复导入，已修正。日期漂移用例现在接受合法的近七日空态；滚动动作用例独立复跑通过。
- Three 异步包仍有超过 500 kB 的构建提示；本轮没有更换渲染框架或隐藏警告。未验证生产部署和真实 DSH Host。

## 下一步视觉债务

本轮是视觉基础与重点入口收敛，不宣称全站已完成重设计。遗留 CSS 仍有分散色值；四个 HUD 与手机焦点的空间分配、选中标签与底部浮层的位置、低层级文字字号，以及 Agent Surface 还需按 DESIGN.md 第 19 节逐项收敛。尤其不应把当前四个 HUD 的并行实现提升为覆盖“最多三个常驻浮层”的新规范。

颜色自动检查只证明 CSS 与 3D token 同源，不证明对比度、布局或审美自动达标。后续 UI 交付仍须实际审图。


## 自转与 HUD 交互修正（2026-09-13）

用户确认自转是核心展示。移除播放／暂停按钮和手动暂停状态，reduced-motion 从禁止自转改为更慢自转；后台、选择和拖动仍暂停。独立 24 Hz 定时请求绘制，帧间实际时间控制角速度，不在 React 中逐帧更新状态。

四角恢复完整玻璃底框；默认名称＋核心数据，hover 展开说明、移出收起；手机点按和键盘切换，Escape 收起。分布默认第一项，展开前三项，数据继续来自同一投影。手机下方 HUD 上移，避开底部投影说明。

本轮固定 fixture 的截图位于 桌面概览（历史截图路径：`../visual-regression/hud-correction/desktop-overview.png`，附件已移除）、桌面展开（历史截图路径：`../visual-regression/hud-correction/desktop-hud-expanded.png`，附件已移除）、手机概览（历史截图路径：`../visual-regression/hud-correction/mobile-overview.png`，附件已移除）、手机展开（历史截图路径：`../visual-regression/hud-correction/mobile-hud-expanded.png`，附件已移除） 及同目录选择／档案／动作／日训练截图。实际审图确认概览摘要与展开有明确层次，手机下方底框避开投影说明。既有手机日训练详情仍使用大 Sheet，展开时遮挡大部分模型；本轮未改动该模式布局。

验证：lint、typecheck、架构、设计 token、build、三项 3D 校验通过；body-explorer 与 muscle-history 共 6 项 E2E 通过。新增回归实测 reduced-motion 下 WebGL 像素仍变化，且无播放按钮；覆盖 HUD hover、键盘与真实触屏事件。未声称全量 E2E 或生产部署通过。


## HUD 默认态回归与内容展开（2026-09-13，覆盖上一节的常驻底框决策）

用户再次明确默认无底框。恢复 `b5f3f35:src/styles.css` 的透明底色／边框／阴影及 hover 玻璃视觉，删除上一轮常驻边线与序号；保留已接通的数据与自转。

首页展开内容由 `OverviewHud` 组织现有 dashboard 响应，`HudCard` 仅拥有展开状态。最近训练提供日期、名称和全部分区组数；七日训练增加时长与明确标记为历史的最近记录；力量组增加 RPE 和口径；肌群展开完整列表与比例条。不新增 API、缓存或训练事实计算。

证据目录 `docs/visual-regression/hud-restored/`：默认／四项展开、探索、焦点、动作与日训练，桌面 1440×900、手机 390×844。固定 fixture 与日期，浏览器审图时冻结自转；真实自转另由 E2E 验证。默认无背景、边框或阴影和 hover 记录列表、展开高度新增显式断言。

本轮验证：lint、lint:architecture、lint:design、typecheck、build 与改动文件格式检查通过，3 项 body-explorer E2E 通过；固定截图已实际审阅默认态、四项展开、桌面／手机焦点与动作投影。3D 实现没有变化，未重复资产校验；构建保留既有 Three 异步包体积提示。

## 主站双主题与整体 UI 接入（2026-09-13）

本节覆盖前文关于冰青选中、主站未迁移和四角规则待定的历史状态。用户已批准六色色卡；本轮主站画面经过实现方实际审图，仍待用户审阅效果。

- Neon 使用三档青色和偏红洋红：青色通用交互／动作主练，洋红当前焦点／动作参与，琥珀独立表达高负荷。Graphite 提供中性、无控件光晕外观；主题切换不改变训练领域状态。
- 主站顶部外观按钮与设置页共享主题选择；浏览器保存主题与强调光效，首帧应用、跨标签页同步，非法存储整体回退默认值。Three 材质与 DOM 共同消费主题；强调光效关闭保留本色、灯光及非重点肌肉基础亮度。
- 面板、时间线、选择器、主站会话外壳及设置页改用 token；工具操作统一 Lucide，保留训练内容和主要行动的中文说明。四角 HUD 默认透明，悬停／点按才出现玻璃详情。
- 移动端收起时间线同时隐藏可见性与点击，避免桌面切手机尺寸时侧栏过渡遮住今日计划；补充正文命中测试。
- 手机图例移到顶部独立区域，修复 320×640 动作预览收起详情后与左下 HUD 数字叠字；图例至少 11px，空态文字 14px，外观弹层在 320／390px 下不横向溢出。

### 审图证据与复现

按上文启动 fixture 服务和 Vite 后执行：

```bash
VISUAL_THEME=neon VISUAL_OUTPUT=test-results/visual-regression/main-themes/neon npm run design:review
VISUAL_THEME=graphite VISUAL_OUTPUT=test-results/visual-regression/main-themes/graphite npm run design:review
```

脚本固定 fixture、日期、视角与视口，每个主题生成桌面 1440×900／手机 390×844 的概览、四项 HUD 展开、选择器、肌肉焦点、动作预览、日训练、外观弹层与设置页。320×640 另做真实浏览器补充审阅；它不是固定截图矩阵的替代品。截图用于人工审阅，未宣称自动像素差异回归。

| 场景 | Neon | Graphite |
| --- | --- | --- |
| 桌面概览 | 截图（历史截图路径：`../visual-regression/main-themes/neon/desktop-overview.png`，附件已移除） | 截图（历史截图路径：`../visual-regression/main-themes/graphite/desktop-overview.png`，附件已移除） |
| 桌面动作预览 | 截图（历史截图路径：`../visual-regression/main-themes/neon/desktop-exercise.png`，附件已移除） | 截图（历史截图路径：`../visual-regression/main-themes/graphite/desktop-exercise.png`，附件已移除） |
| 手机概览 | 截图（历史截图路径：`../visual-regression/main-themes/neon/mobile-overview.png`，附件已移除） | 截图（历史截图路径：`../visual-regression/main-themes/graphite/mobile-overview.png`，附件已移除） |
| 手机肌肉焦点 | 截图（历史截图路径：`../visual-regression/main-themes/neon/mobile-focus.png`，附件已移除） | 截图（历史截图路径：`../visual-regression/main-themes/graphite/mobile-focus.png`，附件已移除） |
| 手机外观弹层 | 截图（历史截图路径：`../visual-regression/main-themes/neon/mobile-appearance.png`，附件已移除） | 截图（历史截图路径：`../visual-regression/main-themes/graphite/mobile-appearance.png`，附件已移除） |

### 持续维护与边界

`lint:design` 同时检查生成 token 一致性、Graphite 未知覆盖键、已迁移主站 CSS 的 hex／rgb／hsl 硬编码颜色。人工临时违规探针已确认能被拒绝并恢复原文件。新增组件仍需进入门禁覆盖范围与标准场景，不能把语法检查视作对比度或审美保证。

本轮未实现屏幕空间 Bloom、外部 JSON 主题导入、Agent iframe 内部主题同步或亮色主题；只验证主站可控范围，未验证真实 Host 与生产部署。320px 矮屏收起详情时底部聊天入口仍可能覆盖脚部，完整身体可通过视角缩放或打开详情查看，后续应继续优化相机与底部区域的自适应。保留既有 Three 异步包体积提示。


### 本轮验证结果

- lint、lint:design、架构检查、TypeScript 与完整生产构建通过；37 项单元／组件、23 项集成测试通过，三项 3D contract／source-map／runtime 校验通过。
- 全量 19 项 E2E 中 17 项首轮通过；另外两项因旧的模糊名称同时匹配 HUD 区域与详情按钮失败。改为精确 region 定位，保持原内容与可见性断言，2 项复跑全部通过。最终全部 19 项均有通过证据，未把首轮描述为全绿。
- 最终审图发现桌面切手机时收起时间线过渡遮挡今日计划，修复后该用例复跑通过；新增不可见侧栏及正文实际命中断言，计划截图禁用 CSS 动画以排除截取过渡中间态。
- 新增 appearance 用例读取实际 WebGL framebuffer，验证主题／重点肌肉自发光变化，及日期、肌肉、动作状态保留；另覆盖手机弹层边界、键盘关闭归焦、刷新持久化与非法存储回退。
- 固定截图已实际审阅双主题桌面概览／焦点／动作及手机概览／焦点／动作／外观，设置页与320px补充场景另作浏览器审图。测试依赖 fixture 与模拟 DSH 事件，不能替代真实 Host 或生产验收。

## 首页配色与时间线纠正（2026-09-13）

用户指出主站首页仍是青／黄，左侧展开后出现多余图标横栏。上轮只调整了焦点／动作配色，却保留首页 red／purple 的琥珀映射，且固定 fixture 未覆盖高负荷；这不是完整的首页换色验收。本节覆盖此前保留人体琥珀高负荷的决策。

- Neon 首页 red／purple 改为中／强偏红洋红，Graphite 同步使用自身中性色阶。警示反馈 token 保留独立，不再用于人体负荷材质；计算规则不变。图例色点同步修改。
- 时间线展开后移除独占整行的工具图标区，收起按钮并入标题右侧；折叠态仍保留展开入口。
- 新增 home-palette E2E 用受控响应覆盖较高负荷，直接读取 WebGL 像素验证青／洋红且无黄色，并检查收起按钮位于标题中、没有额外工具行。该数据只用于视觉状态测试，不是用户训练事实。
- lint、token 门禁、架构检查及生产构建通过；首页高负荷与时间线搜索／日期选择相关 E2E 通过。桌面展开与手机首页截图已实际审阅，证据位于 `docs/visual-regression/home-correction/`。


## 2026-09-13 · 统一毛玻璃与配置后台

本节取代此前四角 HUD 精简态完全透明、顶部外观入口及可关闭主站光效的规则。用户要求所有卡片使用同一种毛玻璃，已抽取 `GlassCard` / `.glass-card`；材质、边缘遮罩、动画与降级在一个 CSS 文件中维护，纳入颜色门禁。

- 配置后台变为四张默认收起的卡片：DeepSeek、界面外观、教练指令、自动计划。桌面两列，手机单列；教练和定时设置分别保存，不覆盖另一张卡的草稿。
- 首页只保留配置入口。Neon 光效固定启用，旧关闭偏好迁移为启用；Graphite 仍为中性、无控件霓虹。后台只填写 DeepSeek Key，不重复配置提供商或模型。
- 建档卡、缺密钥提示、身体探索按钮／弹层、四个 HUD、洞察／计划／动作卡、选中标签、状态提示与历史抽屉共用玻璃。HUD 精简态使用 quiet 层级，展开加深底色；边缘不拦截指针，流光遵守 reduced-motion。
- 实际审图发现建档卡盖住探索选项，已在探索期间隐藏建档／密钥提示，关闭后恢复。缺密钥提示出现时隐藏重复的聊天 launcher。边缘遮罩限制在卡片内部，避免历史抽屉增加横向滚动。
- 例外为布局画布、计划文档、列表行、组次、表单和已有卡片内的空态，避免多层模糊；Agent iframe 内部仍由官方 Surface 管理。

审阅图在 shared-glass（历史截图路径：`../visual-regression/shared-glass/`，附件已移除）：桌面 1440×900、手机 390×844、设置补查 320px；覆盖建档、缺密钥、探索、HUD 精简／展开、高负荷人体、双主题设置与历史抽屉。建档场景使用受控空态投影及凭据状态夹具；负荷图为专门的高负荷夹具，均非真实用户数据。已打开截图检查材质、正文、人体优先级、边缘和遮挡。

验证：lint、lint:design、架构检查、TypeScript／完整 build 通过；48 项单元／组件与 39 项集成曾全量通过，最终改动补跑相关组件及 5 项模型／Host 集成通过；18 项相关 E2E 分批通过。浏览器断言检查实际 backdrop-filter、渐变边缘、指针穿透、旧偏好归一、独立保存草稿及手机边界。自转的 framebuffer 检查与静态 HUD 审图分开执行，静态截图通过已有页面隐藏调度门冻结旋转，没有放宽行为断言。Three 大分包和测试多实例提示仍为既有情况。

真实 DeepSeek Key 连通性、低端真机 GPU 性能、生产部署和外部主题包未由本轮验证。DSH 并行升级独立交付；这里的模型简化依赖官方内置默认配置，不硬编码随版本变化的模型名称。


## 2026-09-13 DSH 0.1.5-rc.2 适配审图

本轮影响 Agent 对话层及按需文件预览，保持中央人体背景与主站时间轴／训练状态布局。使用隔离工作区与真实新版 Host；整体页面为无个人训练记录场景，预览用本地固定回复模型调用官方 read 工具读取测试工作区 AGENTS.md。未复制真实对话作为夹具。

- 桌面 1440×900（历史截图路径：`../visual-regression/dsh-015-desktop.png`，附件已移除）、手机 390×844（历史截图路径：`../visual-regression/dsh-015-mobile.png`，附件已移除）：实际审阅训练文案、输入框、主站覆盖边界、人体轮廓、顶部操作。无页面错误，收起后 iframe 隐藏。
- 桌面文件预览（历史截图路径：`../visual-regression/dsh-015-preview-desktop.png`，附件已移除）、手机文件预览（历史截图路径：`../visual-regression/dsh-015-preview-mobile.png`，附件已移除）：官方 rightbar 在 iframe 内显示；手机全屏预览，预览区使用不透明背景避免和聊天内容重叠。截图关闭有限动画，额外检查桌面右边界和手机 fullscreen 状态。
- 移除 Surface 对上游生成 CSS 类名的覆盖；通过官方品牌插槽覆盖 fallback、官方 locale 扩展提供训练文案。尚未实现主站与 Agent 的动态主题同步。
- 历史轮盘适配新版 Conversation 样式提取与 main 插槽测试夹具。玻璃边缘限制到抽屉内部，修复手机 1px scrollWidth 溢出；轨道、切换、键盘与 reduced-motion 回归仍保留。

这是本地升级审图，不代替全套视觉基线批准、真实模型写业务数据、审批异常矩阵或生产发布 POC。


## 2026-09-30 时间线今日计划显示修复

左侧时间线选中今天后，Day 详情复用首页的今日计划摘要与完整计划入口，并继续单独展示实际训练记录。无实际记录时保留记录空态；其他日期不混入今日计划。未改变布局、主题、人体投影或领域统计。

使用隔离测试工作区与 2026-06-20 计划夹具，在桌面 1440×900、手机 390×844 验证“时间线 → 今天 → 查看完整计划”。模型加载完成后通过页面隐藏调度门暂停自转再截图，已实际审阅计划卡片、文本、入口和手机 Sheet，未发现本次新增遮挡或横向溢出。截图保存在 `test-results/app-shows-today-s-plan-from-the-timeline-at-{1440,390}px-chromium/timeline-today-plan.png`，不提交截图。

验证：新增测试先复现今日计划缺失；修复后 52 项单元／组件测试通过，覆盖今日有／无 workout 及历史日期隔离。5 项相关浏览器用例通过，包含桌面／手机今日计划、历史训练动作、无训练空态和完整计划复制。lint、架构检查、设计 token 检查、typecheck、完整 build 通过；仍有既有 Three 分包体积及测试多实例提示。本轮未运行真实模型或改写个人数据。

## 2026-09-30 人体旋转遮挡修复

本轮属于身体探索／视觉一致性缺陷修复。Overview、Day、Exercise 与 Muscle Focus 继续使用同一套主题和材质状态；新增加的肌肉深度预绘制决定每个像素最近的肌肉表面，消除透明网格前后排序带来的面积性混色。皮肤不写深度，保留低对比轮廓。颜色使用单次双面绘制，避免再次混入背面。显隐与拾取规则、模型几何、训练数据与自转速度未改动。正式规则见 `DESIGN.md` 第 6.4 节。

使用隔离 fixture、固定日期 2026-06-21；Neon / Graphite 两套主题均验证实际生效。模型加载完成后通过既有页面隐藏调度门暂停自转，测试通过挂载的 renderer 固定视角，不新增生产调试接口。桌面 1440×900 检查正面、侧面、背面左右斜角及背面前后各 0.04 弧度；手机 390×844 检查背面概览和训练日／动作／焦点。reduced-motion 开启；既有 `body-explorer` 用例另行验证真实旋转像素、暂停、恢复、键盘关闭和手机点选。

截图已实际打开检查：背阔肌、臀部、肩／上臂、腿部的负荷颜色保持表面覆盖，背面相邻视角没有原先整块突然变暗的混色；焦点与主练／参与颜色可辨认，四肢、头部与皮肤轮廓完整，手机概览与焦点 Sheet 上方保留身体。手机 Day 展开的既有高面板会覆盖大部分身体，本轮比较的是其底层 framebuffer，不把该截图算作布局验收，也未改动面板布局。原资产的三角面、凹凸与几何缝隙仍可见，本轮未平滑或修补几何。选中背阔肌仍可读取档案，真实网格点击、清除、分区探索、主题切换的相关回归通过。

新回归 `tests/e2e/body-occlusion.spec.ts` 在固定视角反转肌肉颜色绘制顺序，直接比较 WebGL framebuffer；只有超过 2/255 的通道差异才计为变化。要求变化像素及其四邻域同时变化的内部像素数为零，单像素交界误差单独记录。测试还仅关闭深度预绘制作为反例，要求重新出现面积性混色，避免截图存在但断言无法识别缺陷。此测试不等于全角度／全 GPU 的逐像素保证。

产物位于已忽略的 `test-results/rotation-occlusion/body-occlusion-*/`：`{theme}-{front,side,left,beforeBack,back,afterBack,right}.png`、`{theme}-mobile-back.png`、`{theme}-{390,1440}-{focus,exercise,day}.png`。相关交互回归截图在 `test-results/body-regression/`，不提交图片。

验证结果：lint、lint:architecture、lint:design、typecheck、完整 build、52 项单元／组件、23 项既有相关 E2E 与 2 项新增遮挡 E2E 通过；三项 `validate:3d-*` 通过。source-map 首次因本机缺少原始素材失败，随后按 source-map 锁定的 revision 下载索引及引用 STL 至临时目录，通过 `BODYPARTS3D_DIR` 指定后复验通过；没有修改校验脚本或运行时资产。普通模式对照实测 draw calls 为 137，预绘制替代原透明双面额外颜色绘制，不宣称达到低端真机 FPS 指标。构建仍有既有 Three 异步分包体积提示，单元测试仍有既有 Three 多实例提示；本轮不涉及 DSH、数据写入或生产发布，未运行相关集成与部署验收。

## 2026-09-30 设置页工作区重设计

用户要求重新设计原四张向下展开的卡片，本轮替换为桌面左侧轻导航与右侧单一编辑区，手机顶部四项导航；设计契约见 `DESIGN.md` 第 10.0.2 节。共享玻璃只用于当前编辑面板，导航、控件与主题示意保持平面；颜色、图标和返回操作继续复用 token、Lucide 与 IconButton。主题预览为 SVG 布局示意，并非真实身体渲染或训练数据。此版本为待用户审阅，未标为 approved 基线。

实际启动 `npm run dev`，前端监听本机 5173、服务监听本机 8787，打开真实设置页确认可显示。隔离 E2E 在桌面 1440×900、手机 390×844 与额外 320×844 窄屏生成 Neon / Graphite 四分区截图；实际打开审阅两主题外观、教练、调度与密钥面板的代表截图，确认导航位置、层级、输入框、按钮和手机换行；未发现横向溢出。首轮发现旧全局按钮与卡片样式覆盖，已通过设置页局部选择器修正，最终截图使用修正版本。

截图位于 `test-results/appearance-settings-sectio-ace2c-rrow-screens-in-both-themes-chromium/{Neon,Graphite}-{1440,390,320}-{界面外观,教练偏好,自动计划,模型连接}.png`，不提交图片。设置页无运行时 3D，自转与肌肉材质未改；本轮未重复主站四模式完整 3D 审图。

验证：lint、lint:design、lint:architecture、typecheck、完整 build 通过；52 项单元／组件测试通过，最终密钥直达与表单调整后聚焦复验 13 项通过。6 项相关 E2E 通过，覆盖主题持久化与非法存储回退、两主题三尺寸四分区、键盘 Enter 与 reduced-motion、教练／调度独立保存及跨分区草稿保留、密钥直达及未提交密钥保留、返回首页。E2E 凭据使用 mock，保存隔离于浏览器请求；未向个人凭据存储写测试密钥，也未运行自动计划或真实模型。既有 Three 分包大小与测试多实例提示仍存在；不将本轮界面验证当作真实 Host、完整 AA 或生产发布验收。
