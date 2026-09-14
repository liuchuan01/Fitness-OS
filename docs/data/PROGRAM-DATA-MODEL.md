# 训练周期与生活指标数据模型

## 目的

日计划仍然是唯一的具体动作处方，真实 workout 仍然是唯一的训练事实。本设计增加周期和生活指标上下文，让外部 Agent 在每日生成计划时不必从零判断本周方向。

这不是 `rolling_summary.yaml` 的替代品：不把计划状态、实际训练和推断结果混写到一个文件。

## 数据边界

```txt
fitness/profile.yaml                 长期稳定档案与训练偏好
fitness/programs/*.yaml                 当前周期的周方向、容量、进阶与复盘规则
fitness/metrics/body.yaml               真实体重、腰围等低频身体指标
fitness/metrics/cardio.yaml             真实跑步等有氧记录
fitness/metrics/nutrition/YYYY-MM-DD.yaml  已核对的每日营养摘要
fitness/plans/YYYY/*.generated.yaml     某日具体训练计划
fitness/workouts/YYYY/*.yaml            某日实际完成训练
```

`fitness/profile.yaml` 只放低频变化的事实和偏好；体重、腰围、跑步和饮食不得回填进去。`programs/` 只描述目标与规则，不记录某日是否完成。计划和 workout 的生命周期语义保持不变。

## 当前实现范围

本周期文件由 DSH Agent 读取，作为每日计划的明确上下文。本地服务不再提供模型计划生成
API，也不组装计划生成提示词；不得让模型计算刺激或恢复结果。

## 每日计划生成顺序

1. 找到覆盖目标日期的 program，并按自然星期匹配当天 slot。
2. 读取最近 3–5 次 workout、最近 7 天 cardio，以及本周已完成训练；用真实训练优先判断恢复与容量。
3. 读取 body、nutrition 的最近有效数据和当天 readiness；缺失值保持未知。
4. 选择当日具体动作和负重。周方向固定，但动作可因器械、恢复和历史表现改变。
5. 只把当天具体处方写入 `fitness/plans/YYYY/YYYY-MM-DD.generated.yaml`；不在 plan 中复制或维护 program 状态。

缺课默认不补偿性合并到后一天；继续进入日历上的下一个 slot。发生疼痛或异常疲劳时，安全与恢复优先于周容量。

## 档案、指标与处方

当前 schema 位于 shared/fitness/profile-schema.ts。正式档案确认带 confirmation.confirmed_at/source；缺失事实不设默认值。训练内容偏好只存档案 preferences，表达方式存 config/settings.yaml 的 agent 分区。测量按实际日期进入 metrics；记录频率、热身和训练编排按个人档案或当前 program 决定，不存在所有用户统一的周一测量习惯。

计划集合支持 prescription.load_selection、target_rpe、target_rir，表示执行处方，不是实际完成值。plan.profile_revision 保存本次使用的档案 SHA256，提交前核对；过期任务必须重读。无体重或负重时估算缺失用 null 表示，已知组数和涉及肌肉仍可展示。
