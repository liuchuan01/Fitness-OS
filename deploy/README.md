# 部署与数据恢复

镜像仅包含应用、公共规则、模板、虚构案例与文档，不复制个人档案或 `data/`。
`WORKSPACE_ROOT=/workspace` 统一推导 `fitness/`、`config/`、`runtime/`。
首次启动只创建元数据和关闭的自动任务配置，不复制案例或旧用户信息。

```bash
# 目录需可由容器内 node 用户（UID 1000）写入
export FITNESS_WORKSPACE_PATH=/absolute/path/to/my-fitness-workspace
docker compose -f deploy/compose.yaml up --build -d
docker compose -f deploy/compose.yaml logs -f training
```

整个用户工作区挂载至 `/workspace`；镜像应用处于只读文件系统。重建镜像不覆盖个人数据。
Fitness 与 DSH 端口分别为主机 `127.0.0.1:8787`、`127.0.0.1:3080`；容器内部监听所有接口。
不要再挂载旧 `data/`。已有 `training-runtime` 卷不会自动删除或复用；先备份后按下面边界迁移。

`fitness/` 可独立 git init / clone，完整恢复档案、计划、实际记录与原始导入。
`config/settings.yaml` 分区保存普通 agent、automation、model 配置，无 API Key 原文。
安装的 DSH `@deepseek-ai/dsh-credentials-local` 支持 `config.path`，Host 的 `credentials` patch
将其设为 `/workspace/config/dsh-credentials.yaml`。DSH 官方凭据读写、0600 权限检查与环境变量优先级保持原样；不增加连接验证。
旧版本默认凭据在旧 `DSH_HOME/.credentials.yaml`。停机备份后可显式迁移到新配置路径并保持 0600 权限；不要把凭据提交进健身 Git。

`runtime/dsh/` 保存聊天与 Host 状态。旧会话绑定原 workspace/cwd，复制 runtime 不能保证恢复；
新工作区使用新 DSH_HOME，旧 runtime 保留备份。恢复旧会话必须单独验证路径归属、刷新和 reconnect。
调度的 claim/retry/cursor 同样不可未经核对复用到新用户。

从旧数据迁移：

```bash
npx tsx scripts/migrate-workspace.ts /path/to/old-app /path/to/empty-new-workspace
WORKSPACE_ROOT=/path/to/empty-new-workspace npm run fitness -- validate all
```

迁移只接受独立空目标，保留旧文件；目标内 `migration-backup/` 与 `migration-manifest.json`
保存原内容、SHA256 和大小。旧偏好按字段去重迁入 profile.preferences，原文保留备份；有 Git 来源日期时记录年龄的时间依据与 migration 来源，非 Git 来源保持待确认。
检查校验、日期引用和历史统计后再设置 WORKSPACE_ROOT 切换。迁移工具将原 runtime 归档在 migration-backup/runtime，旧默认位置的凭据迁入 config/dsh-credentials.yaml（0600），不会激活旧 Session 或调度游标；普通初始化不复制任何凭据。
计算语义版本 2 将缺少实际体重/负重的训练总量由假零或部分数字改为 unknown，公式与刺激恢复值不变。迁移仅在副本重算 computed，calculation-migration-report.json 逐条保留旧值、新值及不含 computed 的事实哈希，原始备份不变。
迁移完成的备份包含个人数据，应放在应用仓库外并按个人资料保护。

删除当前 Git 文件不删除历史；向外发布完整 Git 历史需要另外审查或制作干净快照。
此实现未执行历史重写；生产域名、旧会话迁移与真实模型调用的验证限制见 docs/engineering/DATA-SEPARATION-VALIDATION.md。

DSH 的两个 Fitness plugin 通过根 `package.json` 的本地 `file:` 生产依赖安装。
依赖构建阶段先复制各 plugin 的 package.json，`npm ci` 创建指向 `dsh-fitness/` 的链接；
运行镜像随后复制完整 plugin 代码。这样 Cordis loader 从应用的 node_modules 解析插件，
不依赖开发机残留安装或只在 DSH profile 下创建的链接。生产依赖裁剪保留这两个链接。

正常升级先停止服务，等待 Host 退出后再重建容器。强制终止正在写入的 Host 可能留下
`config/dsh-credentials.yaml.lock`；DSH 官方 atomic-write 不自动删除现存锁，后续启动会等待锁并超时。
遇到该错误时，先停止所有共享此工作区的 Host，备份 `config/`，确认没有任何写入进程后再处理确认遗留的 `.lock`。
不要删除凭据正文，也不要在服务运行时无条件清锁。本应用不修改官方锁语义或自动解锁。
