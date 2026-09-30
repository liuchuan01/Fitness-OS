# 肌肉训练档案：事实查询与展示契约

状态：第一步实现。历史依据优先；下一步区域提供相关动作探索。带上下文与 Agent 制订计划、实际完成录入和进阶分析属于后续阶段。

## 1. 唯一数据流

```text
fitness/workouts/**/*.yaml + resources/fitness/muscles/muscle_map.yaml
  → server/data-store.ts / getMuscleHistoryFromFiles（只读、YAML schema 校验）
  → shared/fitness/muscle-history.ts / buildMuscleHistory（纯函数）
  → shared/fitness/muscle-history-schema.ts（请求与响应契约）
  → GET /api/muscles/:muscleId?date=YYYY-MM-DD
  → src/api/muscle-history.ts（响应 schema 校验）
  → features/muscles/useMuscleHistory（取消、加载、错误、重试）
  → app/Dashboard（选中肌肉、预览动作 ID、日期）
  → BodyViewer3D / DashboardMetrics / MuscleHistoryPanel（渲染与用户事件）
```

训练事实只取 workouts，不读取 plans、聊天记录或原始 imports 来补全完成情况。查询不调用模型，不回填 computed，不写 YAML，不依赖 computed 刺激／恢复分数。

`muscle_map.yaml` 是动作与肌肉关系的唯一来源。`shared/fitness/exercise-labels.ts` 仅提供未练动作的中文显示名称，不复制关系或处方。已练动作使用截至查询日期最近一次真实记录的名称；同一个 ID 可能包含器械／动作版本，因此本阶段不做跨版本重量进步比较。新增 map ID 时同步补中文名称；缺失名称显示“未命名动作”，不会暴露内部 ID。

`shared/fitness/muscle-groups.ts` 是首页与文字选择器共用的肌群分组。人体继续使用 canonical 肌肉 ID；左右网格共用历史，不伪造单侧数据。

## 2. 统计口径

`shared/fitness/training-records.ts` 提供首页和肌肉详情共用的组筛选、日期窗口和动作视图 ID。

| 项目 | 规则 |
| --- | --- |
| 统计日期 | 必填有效公历日期；未知肌肉 ID、缺日期、非法日期返回 422 |
| 近 7 日 | `[date - 6 天, date]`，包含两端，以 UTC 日期计算 |
| 最近训练与历史 | 检索全部已存 workout，但只纳入 `workout.date <= date`；旧记录仍可作为最近训练依据 |
| 力量记录组 | `strength` 和 `accessory` block 中未明确标记 `kind: warmup` 的组；计时组也按记录的组计数 |
| 非力量分区 | `mobility`、其他 block 不纳入力量组数；不靠动作中文名称猜类型 |
| 单组类型 | 可选 `kind: warmup | work`；旧记录缺失时保留未知，不按重量、次序或 RPE 猜测 |
| 主练／参与 | 分别根据现有 `primary`／`secondary` 映射分类；同组同时出现在两侧时主练优先，只计一次 |
| 训练次数 | 窗口内至少有一组关联力量记录的 workout 数；多个关联动作不重复计次 |
| 未分类组 | 关联记录中没有 `kind` 的组数，UI 明示可能包含未标记热身 |
| 缺失值 | 无最近训练日期为 null；负重／RPE 未填保持缺失；零组不解释为“从未训练” |

这里是“记录组”，不是“有效组”。`primary` 并不保证属于孤立训练或精准刺激；现有映射尚未完成逐动作训练学审查。详情明确标注“按动作映射归类，不代表实际刺激效果”。首页保留既有主练 1、参与 0.5 的**折算展示**，采用同一组筛选规则；一个动作命中同肌群多个子肌肉时先按肌群去重。详情分别展示两类原始组数，不把折算数当成实际完成组。

`totalSets` / `computed.total_sets` 仍表示所有分区的总记录组数，与力量记录组不同。本次新增 `kind` 用于事实统计筛选，**不改变既有刺激／恢复公式**，不批量重算或迁移真实 YAML。

## 3. API 与查询所有权

`GET /api/muscles/:muscleId?date=YYYY-MM-DD` 返回 `{ ok: true, muscle }`，字段的唯一可执行定义见 `shared/fitness/muscle-history-schema.ts`：

- `asOf / windowStart`：查询截止日期和窗口起点。
- `lastTrainedDate / lastPrimaryDate`：最近涉及日期和最近主练日期。
- `weekly`：关联训练次数、主练组、参与组、未分类组。
- `history`：日期倒序的训练与关联动作，包含每组原始参数。前端初始展示最近 3 次，可展开全部。
- `relatedExercises`：来自 map 的候选动作，已练优先、最近日期优先，再按主练优先；没有记录的候选也可显示。

响应包含公共 `workoutId` 和 `viewId`，不包含本机文件路径。历史与 Daily Workout 共用 `exerciseViewId`，前端不拼接 ID。当前数据规模下直接构建只读投影，不额外缓存或存储第二份肌肉历史。

客户端以 `(muscleId, date, refreshVersion, retry)` 标识请求。选择变化取消旧请求，过期响应不得覆盖新选择；新查询完成前显示加载态，不短暂显示上一个肌肉的数据。失败显示可重试错误，不转成零训练。已校验的数据变更通过现有 `useDashboardData.refreshVersion` 驱动重新查询，不新增 SSE 订阅或以 Agent 空闲作为刷新依据。`data-invalid` 不推进 revision，保持已显示结果和全局校验提示。这里的读取 schema 校验与全域 validate/finalize 校验职责不同。

## 4. 页面状态与 3D 边界

- `Dashboard` 唯一拥有 `selectedMuscle` 和 `previewExerciseId`；预览动作内容从当前查询结果派生，避免保存第二份动作对象。
- Muscle Focus 是 Overview / Day / Exercise 上的焦点层，不替换底层日期。返回原视图只清除焦点；选历史动作则切换真实训练日期并选中对应动作。
- 3D 点击和 HUD 两层部位选择器使用同一回调，默认单选；取消选择关闭焦点。文字选择器也支持键盘、近似覆盖肌肉和 WebGL 失败场景。
- 3D 默认持续缓慢自转，Canvas 保留按需绘制，由 `BodyMotion` 通过独立定时器按不高于 24 次/秒请求绘制、直接更新模型组变换；DPR 上限 1.25，不通过 React 每帧更新状态。打开部位选择、聚焦肌肉、拖动期间暂停；关闭探索且无肌肉焦点、结束拖动后恢复。后台标签页停止自动调度；reduced-motion 使用更慢自转，不阻止默认启动。没有播放／暂停按钮；清除肌肉焦点自动恢复，重置视角同时归零模型角度。选中隐藏的专业肌肉时允许显示该肌肉。
- 3D 不查询训练历史，不计算组数，不保存另一份业务选择；仅拥有模型加载、悬停、相机、运动、探索分区与专业显示状态。
- `muscles` 只传服务端投影；动作预览另传 `exerciseTargets`，不再把 intensity 提高到 85/45。预览颜色表达主练／参与，明确标为“非刺激评分”。
- 选中标签不展示刺激数字；partial 覆盖用“模型近似显示”说明。首页既有负荷热图保留并标记估算；首页默认洞察改为实际次数与力量记录组摘要，移除仅凭公式判定恢复不足／上下肢均衡的文案，不用肌肉档案推断恢复百分比或可训练时刻。
- 桌面复用右侧 Context Panel；手机复用底部 Sheet，肌肉焦点最大 48dvh，展开时人体画布缩至上方剩余空间，保持腿脚可见；收起不丢失选择。换肌肉或日期重新定位详情滚动位置；相关动作预览不重置历史上下文。

### 身体探索与四角 HUD

`features/muscles/body-regions.ts` 只定义 9 个展示分区，复用共享肌群与 canonical ID；不复制动作映射。`MusclePicker` 管理打开／分区两级导航，通过 `onExplore` 暂停自转并预览分区，通过既有 `onChange` 提交具体肌肉。面板为深色玻璃 HUD，内部滚动，支持 Escape、返回与焦点恢复；不用浏览器原生 select。手机重新探索时由页面收起详情 Sheet，关闭探索后恢复已有肌肉详情，避免详情遮挡长列表。探索期间临时隐藏手机底部的对话与详情入口，关闭后恢复。

Overview 四角 HUD 默认无底框，仅核心摘要常驻；hover 时摘要保持原位，独立详情显示共享玻璃层、移出收起，键盘／触控可切换。Day、Exercise 与肌肉焦点沿用 quiet 玻璃卡片；具体视觉规则见设计第 10.2 节。局部展开状态不参与事实数据流。首页由 `OverviewHud` 读取现有投影的最近记录、时长、RPE 与完整肌群分布；默认分布第一项，展开显示全部，比例条仅为现有组数的视觉归一化。通用 `HudCard` 负责交互，不请求数据。内容：总览展示距上次训练、近 7 日次数、力量记录组、肌群折算分布；聚焦肌肉后切换最近涉及训练日期、近 7 日次数、主练／参与记录组和最近关联动作。`DashboardMetrics` 与详情共用 `useMuscleHistory` 的同一响应，不新增查询或计算。加载／失败不显示为零。

## 5. 维护与验收

改统计规则：先改 `training-records.ts` 和固定样例测试，再检查首页与历史一致性。改 API：先改共享 Zod schema，服务端与客户端共用，不复制手写响应类型。改展示：保持组件不请求 API、不读取 YAML。

验证入口：

- `tests/unit/muscle-history.test.ts`：窗口、未来排除、热身／补充、主次去重、未知值、跳转 ID。
- `tests/integration/muscle-history.test.ts`：真实 HTTP、响应契约、非法输入、计划不计入、只读文件边界。
- `src/features/muscles/useMuscleHistory.test.ts`：切换取消、迟到响应、revision 刷新、失败重试。
- `tests/e2e/muscle-history.spec.ts`：档案、动作预览、历史定位、空态／重试、桌面和手机截图。

后续再增加 Agent 上下文传递、经过核对的器械／动作版本元数据、进步比较及实际完成反馈；不能把本阶段候选动作列表宣传为个性化处方。

## 6. 本次验证记录

- 静态检查：lint、lint:architecture、TypeScript 与生产 build 通过；异步 Three chunk 仍有既有的 500 kB 体积提示，没有提高阈值隐藏。
- 单元／组件：34 项通过。集成：23 项通过。
- 浏览器：肌肉档案新增 3 项、既有 app 回归 7 项通过，包括真实网格点击、历史定位、候选预览、错误重试和移动端。
- 当前全量 E2E 的独立未通过项：工作区并行新增 `session-history.spec.ts` 的会话历史面板 x 坐标对齐断言，实际与目标相差 18px；不是肌肉档案用例，不宣称全量通过。
- 模型：contract、source-map、runtime 三项校验通过。源映射校验所需原始文件取自 BodyParts3D commit `f0eeb6e843380cfe6b83797cf8c3e1af74de5e61`，仅下载到被忽略的 `.tmp/3d-muscle-work/`。
- 测试数据：补齐 6 月 16 日 fixture 缺失的 computed，纠正 6 月 19 日 fixture 总记录组数 6 → 7，使测试数据通过既有校验，避免截图长期显示无效数据；未改真实训练 YAML。
- 视觉证据：桌面（历史截图路径：`../visual-regression/muscle-history-desktop.png`，附件已移除）、手机（历史截图路径：`../visual-regression/muscle-history-mobile.png`，附件已移除），已实际打开检查。

本次没有验证生产部署或真实 Agent 处方；它们不在第一步范围内。

## 7. 身体探索与 HUD 增量验证

37 项单元／组件、23 项集成和全部 3D 校验通过。相关浏览器用例共 12 项分批通过（原 app 7、肌肉档案 3、身体探索 2）；并行构建／浏览器运行时曾出现 app 时间线上滚动的 30 秒超时，独立复跑该用例通过，不据此宣称全量 E2E 通过。新增用例验证真实 WebGL 像素旋转／暂停／恢复、两级导航、移动端长列表底部点选、返回焦点与四角 HUD 的不透明状态。

实际审图视口：1440×900、390×844。证据：桌面分区（历史截图路径：`../visual-regression/body-hud/hud-regions.png`，附件已移除）、桌面档案（历史截图路径：`../visual-regression/body-hud/hud-focus.png`，附件已移除）、手机选择（历史截图路径：`../visual-regression/body-hud/hud-explorer-mobile.png`，附件已移除）、手机档案（历史截图路径：`../visual-regression/body-hud/hud-focus-mobile.png`，附件已移除）。修正了旧移动端样式隐藏下方 HUD、Sheet 与底部入口遮挡选择列表、工具栏挤占肌肉名称的问题。
