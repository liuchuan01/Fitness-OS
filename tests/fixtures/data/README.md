# Data

本目录是第一版本地 YAML 数据源。

当前阶段 2 样例数据：

- `muscles/muscle_map.yaml`：动作到 canonical muscle id 的映射。
- `muscles/stimulus_rules.yaml`：确定性刺激计算的 MVP 参数。
- `metrics/readiness.yaml`：恢复评分输入。
- `workouts/2026/*.yaml`：真实训练样例，`computed` 由本地程序写回。
- `plans/2026/*.generated.yaml`：AI 计划样例，`computed_expected_stimulus` 由本地程序写回。

规则：

- AI 不直接写入本目录。
- `computed` / `computed_expected_stimulus` 只由本地服务根据 schema、muscle map 和 stimulus rules 计算。
- 本地服务写入 YAML 前会生成同名 `.bak` 备份；备份文件被 `.gitignore` 忽略。
