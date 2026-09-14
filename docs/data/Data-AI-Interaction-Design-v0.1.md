# 数据与 AI 交互：导航与历史说明

本文件原 v0.2 结构示意已被独立工作区实现替代；旧目录、默认身体事实、服务直接生成模型输出和自动复制计划为实际训练的描述不再适用。历史全文保留于 Git 历史，不作为当前 Agent 任务依据。

当前唯一目录与写入边界见 [FITNESS-DATA-ARCHITECTURE.md](FITNESS-DATA-ARCHITECTURE.md)，字段与确认语义见 [PROGRAM-DATA-MODEL.md](PROGRAM-DATA-MODEL.md) 及 `shared/fitness/schema.ts`、`shared/fitness/profile-schema.ts`。

可阅读的完整虚构案例见 [examples/fitness-starter](../../examples/fitness-starter/README.md)，空结构见 [templates/fitness](../../templates/fitness/README.md)。示例不是用户默认数据；年龄、体重、无伤病声明、训练日程和 RPE 不自动填充。

Agent 在用户授权范围内读取当前档案、提出并保存运行目录草稿；本地 CLI 负责 schema、计算、档案版本冲突检查和原子提交。已确认档案、周期方向、每日处方、实际完成和测量数据具有独立生命周期。实际训练只根据明确报告或确认提交，处方中的目标用力程度不复制成实际 RPE。

公共肌肉关系与计算规则由应用 `resources/fitness/` 维护；模型不得修改或手写计算结果。无历史与估算缺失独立表达，不能把未知当作零或健康恢复百分比。
