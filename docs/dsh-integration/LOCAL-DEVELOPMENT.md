# 本地运行、迁移与 Git 恢复

Fitness、DSH、CLI、导入与自动任务共用 `WORKSPACE_ROOT`。工作区中的 `fitness/` 保存个人业务数据，`config/` 保存设置与官方凭据，`runtime/` 保存会话、调度和草稿。公共资源始终来自应用安装目录；`tests/fixtures/` 和 `examples/` 不用于日常正式数据。

## 新工作区

从应用目录执行：

```bash
npm ci
export WORKSPACE_ROOT=/absolute/path/to/my-fitness-workspace
npm run fitness -- init
npm run dev
```

初始化可重复执行，不覆盖已有档案或设置。没有个人测量、周期、计划和训练记录，自动任务默认关闭。不指定 WORKSPACE_ROOT 时，默认使用应用目录下被忽略的 `.workspaces/default`；开发时放在应用仓库内的其他工作区，也必须整体加入外层 Git 忽略规则。

网页为 `http://127.0.0.1:5173`，Fitness API 为 `http://127.0.0.1:8787`，DSH Host 为 `127.0.0.1:3080`。这些是运行代码的本机地址；远程访问使用已有端口转发或另行部署拓扑。

模型 Key 沿用网页配置页或 `DEEPSEEK_API_KEY` 环境变量，既不写入普通 settings，也不作为建档确认或连接测试步骤。DSH 官方凭据路径为 `config/dsh-credentials.yaml`，保持 0600 权限。`DSH_PROVIDER` / `DSH_MODEL` 显式环境覆盖优先于普通设置中的模型选择；否则读取 settings.model，再使用官方默认值。保存普通模型选择后重启服务／Host，不改写历史 Session 的模型选择。

## CLI 与生产构建

所有命令携带同一 WORKSPACE_ROOT。从应用目录使用 npm 入口：

```bash
npm run fitness -- onboarding status
npm run fitness -- validate all
npm run fitness -- finalize plan /absolute/path/to/my-fitness-workspace/runtime/onboarding/first-plan.yaml
```

从工作区目录执行时，使用生成的 `AGENTS.md` 中的完整 CLI 命令，不要求工作区有 package.json。正式计划修订使用 `revise plan <runtime-draft> <expected-plan-sha256>`；工作区、档案或原计划发生冲突必须重读并重新确认，不覆盖已有结果。

```bash
npm run build
npm run start:service
```

构建后的本机预览为 `http://127.0.0.1:8787`；源码目录中的构建 CLI 为 `node dist-server/server/fitness-cli.js`。Docker 镜像将构建产物安装到 `/app/server/`，以生成的工作区导航为准。更新代码后重启服务与 Host，前端热更新不会更新已启动的 Host。

旧 DATA_ROOT、FITNESS_ROOT、RUNTIME_ROOT、DSH_HOME 只有与工作区推导路径相同时才兼容；冲突会明确报错，不回退另一个 data 目录。

## 旧数据迁移

先准备应用仓库外的独立空目标：

```bash
WORKSPACE_ROOT=/absolute/path/to/empty-destination npm run fitness -- migrate /absolute/path/to/legacy-app
WORKSPACE_ROOT=/absolute/path/to/empty-destination npm run fitness -- validate all
```

迁移保留原文件，并生成原始 SHA256 清单与 backup、配置迁移记录、计算语义升级报告。档案与周期的历史确认标记为 migration，年龄时间依据取实际 Git 来源。偏好按字段整理，原文留在备份。核对记录数量、来源引用、统计及报告后，再把日常 WORKSPACE_ROOT 切换到目标。

旧 runtime 归档，不将旧 Session 或调度游标直接激活到新工作区。旧聊天依然保留在备份，恢复时须另外核对原 cwd 与 Session 归属。迁移报告和备份含个人资料，保存在应用仓库外。

## 其他机器升级时保留记录

此次提交从应用 Git 当前树删除旧 `profile.yaml` 和已跟踪的个人 `data/` 文件。其他机器直接 pull 后，这些旧路径的文件也会删除；本机迁出的工作区不会通过应用仓库自动同步。旧提交中的记录仍在 Git 历史里，但不会自动加载到新应用。

尚未拉取时，先停止旧服务，在旧应用目录把当前实际文件复制到仓库外，包含本机尚未提交的记录：

```bash
legacy_backup=$(mktemp -d "${TMPDIR:-/tmp}/fitness-legacy-backup.XXXXXX")
cp -a profile.yaml data "$legacy_backup/"
# 若需要保留旧聊天与配置运行状态，再执行：
[ ! -d runtime ] || cp -a runtime "$legacy_backup/"
git pull --ff-only
npm ci
export WORKSPACE_ROOT="$HOME/my-fitness-workspace"
# WORKSPACE_ROOT 必须是新建或空目录。
npm run fitness -- migrate "$legacy_backup"
npm run fitness -- validate all
npm run dev
```

核对完成前保留备份；如 Git 因本地改动拒绝 pull，先处理并保留这些改动，不执行强制 reset 或 clean。

若已经拉取，仍可从迁移前提交建立只读用途的旧版本检出，再使用新应用的迁移命令：

```bash
git worktree add --detach ../fitness-legacy-recovery f297ed3f4d5c989c02025b7dd7c14a639a7635be
WORKSPACE_ROOT="$HOME/my-fitness-workspace" npm run fitness -- migrate ../fitness-legacy-recovery
WORKSPACE_ROOT="$HOME/my-fitness-workspace" npm run fitness -- validate all
```

该历史恢复只包含当时已提交的数据，不包含其他机器后来新增且未提交的记录或旧 runtime。若以已经迁好的另一台机器为准，安全复制其工作区 `fitness/` 到本机工作区即可，再执行 init、validate all，并始终使用相同 WORKSPACE_ROOT。多台机器各有新增记录时先备份、合并并校验，不能直接覆盖。后续代码 pull 不会删除仓库外或被忽略的工作区数据；个人数据同步需要独立备份或私有健身 Git 仓库。

## 独立健身 Git

`fitness/` 是独立备份单位。以下命令仅作为用户手动操作说明；初始化和迁移不会自动运行它们：

```bash
cd /absolute/path/to/my-fitness-workspace/fitness
git init
git add .
git commit -m "Back up confirmed fitness data"
```

只把 fitness 目录纳入该仓库，不能加入兄弟目录 config、runtime、凭据或迁移备份。恢复时先克隆自己的健身仓库到新工作区的 fitness 目录，再设置 WORKSPACE_ROOT 运行 init（不覆盖已有文件）和 validate all；配置、Key 和聊天按需另行恢复。Git 合并或切换分支成功不等于业务数据有效。

扫描、审计与监听排除 `.git/`，分支恢复后的正式文件仍重新校验。数据 SSE 只在通过校验后刷新页面；反向代理需允许 `/api/data-events` 长连接。读取错误不会加载案例，也不会自动重写草稿。

应用当前树移出个人文件不清除 Git 历史。对外发布完整仓库前，单独决定历史清理或审查后的干净快照；本次实现没有执行历史改写。


## DSH 0.1.5-rc.2 更新

`npm ci` 使用锁定的 rc.2；升级后重启 Fitness service 与 DSH Host。本轮按用户要求采用新会话状态，不维护旧会话迁移兼容层。其他机器同样采用全新状态时，先停止服务，将工作区 `runtime/dsh` 移到同级的独立归档目录，再启动应用自动创建新状态。不要移动或清空 `fitness/`、`config/` 或其他 runtime 子目录。

无 Key 回归入口为 `npm run test:integration -- tests/integration/dsh-installed-host.test.ts`，需要本机 Playwright Chromium（首次可执行 `npx playwright install chromium`）。它使用临时 profile 与测试模型，不访问正式会话或模型服务。可选设置 `FITNESS_DSH_REVIEW_DIR` 保存预览审图截图。
