# 虚构首次训练案例

林小禾、日期、目标和场景均为合成案例，与仓库原用户无关。profile 是已确认的示例档案；program 描述观察方向；plan 是尚未完成的动作处方。没有 workout 和测量，意味着尚无这些事实，不代表零值或无不适。

plan 的 computed_expected_stimulus 由公共 calculateStimulus 生成；未知负重不产生可用估算。profile_revision 是示例档案原文 SHA256。文件需按相同 schema 校验，不能将模板当作确认档案。

默认初始化不会读取此目录。演示需显式初始化独立工作区，再将本目录的 profile.yaml、programs/、plans/ 复制到其 fitness/，从应用目录设置 WORKSPACE_ROOT 后执行 npm run fitness -- validate all。不要导入正在使用的个人工作区；不要把示例处方当成个人建议。只查看文件无需导入。
