# 主题包作者指南（协议 v1）

主题包为 JSON 配置与本地资源。应用负责页面布局、交互和人体语义；作者无需修改 React、CSS 或重新构建应用。协议的可执行定义是 `shared/themes/schema.ts`，内置示例位于 `resources/themes/`，可安装模板位于 `examples/themes/slate-studio/`。

## 1. 制作、安装与卸载

复制完整模板，修改目录名、`theme.json` 的 `id` 和显示名称：

```text
themes/
  slate-studio/
    theme.json
    preview.png
    LICENSE
    assets/
      custom.woff2       # 可选，自行提供有分发许可的字体
```

安装目录是 **`<WORKSPACE_ROOT>/themes/<id>/`**，未设置 `WORKSPACE_ROOT` 时默认是应用根目录的 `.workspaces/default/themes/`，与工作区 `fitness/` 平级；不是源码 `src/`、训练数据目录或浏览器下载目录。内置主题位于应用的 `resources/themes/`，用户包不能覆盖内置 ID。容器部署需把工作区作为持久卷保留。

1. 在仓库运行 `npm run validate:theme -- /path/to/slate-studio` 校验。
2. 把完整目录复制到工作区 `themes/`。更新时建议先在目录外准备完整包，再替换目录，避免扫描到半写入文件。
3. 刷新浏览器，在「配置后台 → 界面外观」选择主题；无需重新构建或重启服务。
4. 更新文件后再次刷新。卸载时删除包目录并刷新，已选主题确定不存在时回退 Neon。

启动时若保存的是外部主题，应用最多等待 1200 ms 预载目录；超时会先用内置外观启动，随后继续加载并报告错误，不把暂时不可用当作卸载。自定义字体准备最多等待 3000 ms，失败或超时后使用预设字体并显示提示。

第一版没有文件监听、在线商店、上传界面、自动更新或主题执行代码。浏览器只保存所选 ID；安装不会写入训练 YAML。包仅覆盖主站与 3D 人体；DSH Agent iframe 尚未同步。

## 2. 顶层字段

所有对象都拒绝未知字段，字段名区分大小写。必需字段如下，其余字段可省略并使用 v1 默认值。省略值以协议默认值为准，不根据包名或另一主题自动继承。

| 字段 | 类型与约束 | 默认 |
| --- | --- | --- |
| `schemaVersion` | 必需，整数 `1` | 无 |
| `id` | 必需，`^[a-z][a-z0-9-]{0,63}$`，与目录名一致 | 无 |
| `name` | 必需，去除首尾空白后 1–80 字符 | 无 |
| `version` | 必需，`数字.数字.数字`，例如 `1.0.0`，不支持预发布后缀 | 无 |
| `appearance` | 必需，`"dark"` 或 `"light"` | 无 |
| `description` | 最多 300 字符，显示在选择界面 | 空字符串 |
| `author` | 可选，最多 100 字符 | 不显示 |
| `tokens` | 下节中的语义颜色对象 | Neon 配色 |
| `typography`、`material`、`effects`、`body`、`assets` | 后续章节定义的对象 | 对应字段默认值 |

最小合法包：

```json
{
  "schemaVersion": 1,
  "id": "my-theme",
  "name": "我的主题",
  "version": "1.0.0",
  "appearance": "dark"
}
```

这个包外观采用默认值。制作不同风格时建议复制完整模板，保留已验证的正文、状态与人体配色关系。

## 3. 语义颜色 `tokens`

键名中的点是 JSON 键的一部分，不是嵌套对象。普通颜色必须是六位十六进制 `#RRGGBB`；仅边界与玻璃四项另外允许 `rgba(R, G, B, A)`，RGB 是 0–255 整数，A 是 0–1。不得填入 CSS 表达式、变量、URL、三位 hex 或颜色名称。

| 键 | 消费语义 | 默认值 |
| --- | --- | --- |
| `background.canvas` | 页面与人体背景 | `#070912` |
| `background.surface` | 基础内容层 | `#111422` |
| `background.raised` | 抬高内容层 | `#1b2032` |
| `text.primary` | 正文 | `#f1f5ff` |
| `text.muted` | 次要文字 | `#a4afc5` |
| `interaction.primary` | 主要交互与动作主练 | `#00e5ff` |
| `interaction.primarySoft` | 中阶主强调 | `#57b8c3` |
| `interaction.primaryMuted` | 弱主强调 | `#789da2` |
| `interaction.selection` | 选择／焦点 | `#ff477e` |
| `interaction.selectionSoft` | 中阶选择与动作参与 | `#cb718c` |
| `interaction.selectionMuted` | 弱选择色 | `#aa8792` |
| `status.warning` | 需要注意的状态 | `#e5ad72` |
| `status.danger` | 错误／危险 | `#ff8e8e` |
| `status.success` | 成功 | `#75d6af` |
| `border.default` | 弱边界 | `rgba(164, 175, 197, 0.16)` |
| `border.strong` | 增强边界 | `rgba(164, 175, 197, 0.32)` |
| `surface.glass` | 玻璃底色 | `rgba(12, 16, 28, 0.88)` |
| `surface.glassRaised` | 抬高玻璃底色 | `rgba(22, 28, 44, 0.94)` |
| `body.skin` | 皮肤外轮廓 | `#415767` |
| `body.unbound` | 未绑定网格 | `#364956` |
| `body.noData` | 零负荷／无数据 | `#536878` |
| `load.low` | 低负荷离散状态 | `#789da2` |
| `load.moderate` | 中负荷离散状态 | `#57b8c3` |
| `load.high` | 高负荷离散状态 | `#cb718c` |
| `load.peak` | 峰值离散状态 | `#ff477e` |

人体负荷是连续插值，离散 `load.*` 不替代连续色带。主练、参与、焦点与错误不是同一语义。不要只靠颜色区分模式；应用保留图例与名称。

## 4. 字体 `typography`

| 字段 | 可用值 | 默认 |
| --- | --- | --- |
| `body` | `system`、`sans`、`serif`、`mono` | `system` |
| `heading` | 同上 | `system` |
| `numeric` | 同上 | `mono` |
| `font` | 可选包内 `.woff2` 路径 | 不加载自定义字体 |

预设由应用维护对应系统字体回退。声明本地字体时由应用加载并优先用于正文和标题，数字仍保留 `numeric` 预设；不支持远程 URL、任意字体 CSS、多个字重文件或字体脚本。自定义字体不可用时保留预设回退。作者负责确认字体资源的分发许可和中文覆盖。

## 5. 玻璃材质 `material`

全部是有限数值，不接受带单位字符串。模糊与圆角单位为 px，透明度无单位。

| 字段 | 用途 | 范围 | 默认 |
| --- | --- | --- | --- |
| `blur` | 普通玻璃模糊 | 0–24 | 8 |
| `quietBlur` | HUD 安静层模糊 | 0–24 | 5 |
| `expandedBlur` | 展开层模糊 | 0–24 | 8 |
| `radius` | 共享 GlassCard／IconButton 圆角 | 8–24 | 16 |
| `panelShadowOpacity` | 面板阴影强度 | 0–0.6 | 0.34 |
| `fillOpacity` | 普通层填充强度 | 0.2–1 | 0.48 |
| `quietFillOpacity` | 安静层填充强度 | 0.2–1 | 0.34 |
| `expandedFillOpacity` | 展开层填充强度 | 0.2–1 | 0.58 |
| `edgeOpacity` | 普通层边缘强度 | 0–0.6 | 0.38 |
| `quietEdgeOpacity` | 安静层边缘强度 | 0–0.6 | 0.22 |

这些参数不改变面板位置、断点、人体安全区和触控尺寸。`surface.glass*` 颜色与填充参数共同影响可读性，必须查看实际界面。

## 6. 动效与人体

`effects`：

| 字段 | 类型／范围 | 默认 |
| --- | --- | --- |
| `glow` | 布尔值，控件局部光效 | `true` |
| `edgeAnimation` | 布尔值，表面边缘动画 | `true` |
| `duration` | 0–500 ms，IconButton 过渡时长 | 150 |

应用始终尊重 `prefers-reduced-motion`。没有屏幕空间 Bloom、扫描线、全屏光效或任意动画定义入口。

`body`：

| 字段 | 用途 | 范围 | 默认 |
| --- | --- | --- | --- |
| `lightColor` | 可选六位 hex 环境／主灯颜色；未填时暗色取正文色、亮色取 raised 色 | 六位 hex | 按 appearance 回退 |
| `focusEmission` | 焦点自发光 | 0–1 | 0.48 |
| `baseEmission` | 基础自发光 | 0–0.3 | 0.06 |
| `skinOpacity` | 皮肤透明度 | 0.05–0.3 | 0.12 |
| `roughness` | 肌肉材质粗糙度 | 0.2–1 | 0.68 |
| `metalness` | 肌肉材质金属度 | 0–0.4 | 0.04 |
| `hemisphereIntensity` | 环境半球光强度 | 0–3 | 0.9 |
| `keyLightIntensity` | 主灯强度 | 0–3 | 1.2 |
| `fillLightIntensity` | 补光强度 | 0–3 | 0.55 |
| `loadColors` | 正值负荷连续色带 | 恰好 7 个六位 hex 色值，按低到高排列 | 见下文 |

默认色带是 `#00e5ff → #65c3d7 → #8aaabd → #a292b1 → #bb7da5 → #dc6594 → #ff477e`。示例主题显式声明色带。零负荷与缺失值仍使用 `body.noData`，不占色带。主题不能替换 GLB、肌肉映射、训练计算、镜头布局或灯光位置。

## 7. 资源声明与限制

`assets.preview` 可指向 PNG 或 WebP。未声明时使用应用自动生成的示意；它不是截图或人体模型。模板的 `preview.png` 是原创色板示意。

`theme.json` 最大 64 KiB，每个资源最大 5 MiB。资源扩展名还需匹配对应文件头；内容变更会更新资源 URL 的版本查询参数。

资源路径相对于包目录，不能包含绝对路径、反斜杠、`..`、查询参数或远程协议。使用简单 ASCII 字母、数字、`-`、`_` 目录名和文件名，例如 `preview.png`、`assets/custom.woff2`。扩展名使用小写。资源服务仅暴露 manifest 声明的预览图和字体；`LICENSE`、`theme.json` 与未声明文件不作为通用静态目录发布。主题目录和包内资源路径禁止符号链接；清单及资源必须是普通文件，FIFO、socket 和设备文件会被拒绝。

缺失可选资源会产生诊断并使用对应回退，不影响合法主题的发现。资源格式与文件边界验证不替代浏览器解码及视觉验收。字体、图片许可说明应随包分发；不要把密钥、训练数据或私人照片放入主题目录。

## 8. 校验与调试

- `npm run validate:theme -- <目录>`：检查 manifest、资源和可读诊断；任何资源诊断也会返回非零退出码，便于发布前发现问题；运行时缺失可选资源仍允许回退。目录名与 ID 必须一致。
- `GET /api/themes`：返回合法主题、`diagnostics` 和 `complete`。单个非法包隔离，不阻断其他包；目录不可读与主题确实不存在不同。
- `GET /api/themes/<id>/assets/<声明的相对路径>`：用于资源检查；无声明、非法路径或缺失文件不会作为通用文件请求成功。
- 浏览器检查根元素 `data-theme`，确认已应用的 ID。默认偏好保存在 `fitness:appearance:v2`（自动读取旧 `v1` 偏好）；切换应同步到同源其他标签页。

常见问题：ID 与目录名不同、拼错语义键、三位 hex、越界数值、协议版本不是 1、缺少必需字段、与内置主题重名。它们都不能靠修改 CSS 规避。

发布前按 `DESIGN.md` 第 7、10、19 节，在桌面 1440×900 与手机 390×844 检查 Overview、Day、Exercise、Muscle Focus，等模型 ready 后审图；检查人体完整、文字可读、空态、键盘焦点、reduced motion、切换保留业务选择与设置草稿。结构校验通过不代表对比度、中文字体或视觉层级已达标。亮色主题应显式提供完整的浅色表面、深色文字、独立照明和可辨的人体色带，参考内置 `resources/themes/orbital/theme.json`；省略颜色仍采用 Neon 默认值。Agent iframe 同步、背景纹理和可执行插件不属于协议 v1。

## 9. Orbital 内置主题与切换反馈

2026-10-05 按用户提供的高达 00 驾驶舱参考新增第三套内置主题 Orbital / 轨道座舱。协议 v1 增加 `appearance: "light"` 和可选 `body.lightColor`，原暗色包继续使用原默认值。Neon、Graphite、Orbital 三个 ID 均保留给应用，服务目录暂时不可读时也不允许安装包占用。

选择需要预载字体的主题时，单选项立即反映待选目标，画面在准备完成后整体切换；等待期间重选原主题会取消待切换，旧字体完成后不得覆盖最后一次选择。
