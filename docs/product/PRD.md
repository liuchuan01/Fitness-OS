# AI Fitness OS - Product Requirements Document

## Product Vision

打造一个以身体为中心（Body-Centric）的 AI Fitness Operating System。

用户不再管理训练记录，而是管理自己的身体状态。

训练记录、恢复状态、疲劳程度、肌群刺激、未来计划全部映射到同一个 3D 人体模型。

核心理念：

Body is the Interface.

---

# Core Modules

## MVP Scope

第一版只做能闭环的核心路径：

1. Body Dashboard
2. Workout Timeline
3. Daily Workout View
4. AI Plan Generator
5. Deterministic Stimulus / Recovery Projection
6. AI Coach Workout Review

暂缓：

* Muscle Bank 独立页面
* Progress Tracking 完整趋势分析
* Future Projection
* 周期训练规划
* 外部设备同步
* 视频动作分析

分层原则：

* Layer 1：真实训练记录和计划生成闭环。
* Layer 2：肌肉刺激、恢复度、训练平衡分析。
* Layer 3：长期趋势、周期规划、未来预测。
* Layer 4：设备同步、视频识别、动作纠正。

---

## 1. Body Dashboard

默认首页。

展示：

* 3D人体模型
* 最近训练刺激热力图
* 恢复状态
* 本周训练统计
* AI建议

### Visualization

肌群颜色：

* Gray = 无记录或低估算负荷
* Blue = 低估算负荷
* Orange = 中等估算负荷
* Red = 高估算负荷
* Purple = 高累计估算负荷（不能据此判断真实恢复不足）

支持：

* Rotate
* Zoom
* Muscle Hover
* Muscle Click

3D 技术与模型资产策略见 `../engineering/TECHNICAL-ARCHITECTURE.md`。

---

### 肌肉训练档案（当前第一步）

从人体单击或分组文字选择器进入，历史依据在前，下一步动作探索在后：

- 最近涉及日期、最近主练日期、截至当前查看日期的近 7 日主练／参与记录组及训练次数。
- 历史动作及每组真实参数，可跳转到对应训练日并定位动作。
- 相关动作已练优先，点击预览主练／参与肌肉；不自动作为今日处方。
- 桌面右侧面板、手机半屏详情；没有记录与读取失败分别表达。
- 详情不显示恢复百分比，预览高亮不改变刺激数据。

数据与验收契约见 [肌肉训练档案](../data/MUSCLE-HISTORY.md)。Agent 上下文传递和实际完成反馈为下一步，不包含在本阶段。

## 2. Workout Timeline

左侧导航。

替代传统文件树。

结构：

Today
Yesterday

Week 24
Week 23
Week 22

支持：

* Calendar Heatmap
* Timeline Mode
* Search

训练强度决定颜色深度。

---

## 3. Daily Workout View

点击某一天进入。

展示：

### Center

3D Body

显示：

当日刺激肌群

### Top Right

训练摘要

* 时长
* 总组数
* 训练量
* 疲劳评分

### Bottom Left

动作列表

每个动作：

* 名称
* 组数
* 重量
* 次数
* RPE

点击动作：

3D人体切换为该动作肌群图。

---

## 4. AI Plan Generator

用户输入：

例如：

今天想练背

只有40分钟

最近腰有点累

目标提升引体向上

---

AI输出：

### Training Goal

### Training Logic

### Workout Plan

### Expected Muscle Stimulus

### Recovery Impact

生成后：

直接投影到3D人体。

支持：

* Regenerate
* Optimize
* Reduce Fatigue
* Increase Intensity

---

## 5. Muscle Bank

统计近：

* 7天
* 14天
* 28天

训练刺激累计。

显示：

每块肌肉训练量。

发现：

* 训练不足
* 训练过量
* 不平衡

---

## 6. Recovery Engine

根据：

* 最近训练
* RPE
* 训练间隔
* 睡眠
* 主观疲劳

根据已有训练历史计算肌肉恢复负荷。用户未填写睡眠、酸痛、疲劳和情绪时，不生成主观状态分数。

输出：

* 肌肉恢复负荷：根据最近训练刺激和训练间隔逐肌肉计算。

肌肉恢复负荷可视化到身体模型。

---

## 7. Progress Tracking

自动生成：

### Strength

估算1RM

### Endurance

跑步
骑行
爬楼

### Mobility

髋关节
肩关节
踝关节

### Skill

引体向上
双杠臂屈伸
倒立

---

## 8. AI Coach

每次训练结束自动生成：

训练总结

内容包括：

* 本次亮点
* 问题分析
* 恢复建议
* 下一次训练建议

风格：

像专业私教而非聊天机器人。

---

## 9. Future Projection

预测：

4周
8周
12周

如果按照当前计划执行：

* 肌群发展趋势
* 力量趋势
* 训练平衡性

结果映射到人体模型。

---

# Future Features

* Apple Watch同步
* Garmin同步
* HealthKit同步
* 动作视频分析
* AI动作纠正
* AI训练周期规划
* AI增肌/减脂模式
* AI比赛备赛模式

## 新用户入口

独立工作区从空白数据开始，分轮建档、摘要确认、首份计划和实际反馈遵循 [ONBOARDING.md](ONBOARDING.md)。案例不自动成为个人数据。
