# 开源与朋友试用准备度审查（2026-09-14）

后续处理：用户已选择 Apache-2.0，本轮已添加许可证并删除截图附件，修正 lint 错误及支持脚本绝对路径；Git 历史由用户另行清理，跨来源写入明确暂缓。本报告下文保留审查时基线，不代表这些后续项仍完全未处理。

审查基线：`703dd2a`。这是一次发布前审查记录，不改变既定路线图，不代表发布、生产验收或逐行安全审计。未修改业务实现、个人工作区、Git 历史或既有未跟踪截图。

## 结论

数据分离已形成可用实现，项目可以进入修复后的单人本地 Alpha 试用准备阶段；当前不应直接公开现有 Git 仓库，也不应把单个实例直接开放给朋友共用。公开发布至少需要先处理隐私内容、跨来源写入、代码许可和失败的质量门禁，并完成一次真实模型业务闭环。

| 交付方式 | 当前判断 |
| --- | --- |
| 当前仓库连同完整历史公开 | 不通过：历史个人数据、当前媒体及样例来源未完成清理 |
| 脱敏快照开源、朋友各自本地安装 | 安装与核心自动回归有基础；先修下述阻塞项，定位 Alpha |
| 单个服务供多人或公网使用 | 不通过：没有 Fitness 用户认证/租户隔离，生产 Agent origin 未验收 |

## 主要发现

### F1 / P1：历史和当前树仍有个人内容，迁移不等于可公开

- `git rev-list --objects --all` 中，历史 `data/imports/`、`data/workouts/`、`data/metrics/` 和 `profile.yaml` 相关唯一路径共 90 个。旧档案可从迁移前提交恢复；`.gitignore` 不能清除此类历史。
- 当前 HEAD 跟踪 126 张图片。实际检查 `pic/img_1.png`，可读到个人对话及训练状态。仅从当前代码导出快照仍会包含该文件。
- `tests/fixtures/data/README.md` 仍称 workouts 为“真实训练样例”；`metrics/readiness.yaml` 与历史提交 `704be902` 中原 data 文件逐字节相同。这证明存在旧内容搬入 fixtures 的情况，但不据此断言所有 fixture 均为真实个人事实。
- 当前树未跟踪 `profile.yaml`、`config/`、`runtime/`、`.workspaces/` 下正式个人文件，这是分离工作的有效成果。

建议：旧库保持私有，从脱敏后的当前树建立全新公开仓库。逐一核对媒体、样例、文档中的个人信息；对来源不确定的 fixtures 用合成数据替换。不能把未复核的 `git archive HEAD` 直接当作可公开包。

密钥检查边界：对本地所有 refs 可达文本 blob 做了常见 `sk-`、GitHub token、私钥头及 URL token 模式检查，未命中；这是启发式筛查，不能证明不存在其他格式密钥、图片内凭据、远端不可见 refs 或已外传副本。没有输出凭据原文。

### F2 / P1：浏览器跨来源请求可以写入真实 workout

定位：`server/app.ts:259`、`:370`、`:394`。

路由没有校验 Origin/Host 或 CSRF 凭据；`readJsonBody()` 不要求 JSON Content-Type。CORS 仅限制浏览器读取响应，不能阻止简单 POST 的副作用。

复现使用临时工作区和测试 fixture、两个独立 loopback origin、真实 Chromium：从另一个端口的页面，以 `Content-Type: text/plain` 向 `/api/workouts/finish` POST JSON，引用已存在的 fixture plan 并设置 `confirmed_as_planned: true`。浏览器报告 CORS 读取失败，但服务已创建目标 workout 文件。探针没有接触真实个人训练数据，服务和临时数据均已清理。

此外，在隔离实例上，无认证 GET `/api/agent/settings` 返回 200；携带不可信 Origin 的 PUT 同样返回 200。后一项是 HTTP 客户端检查，不等同于浏览器跨域 PUT 绕过预检的证明。

建议：在写入路由前统一拒绝非允许来源和非法 Host，严格校验 JSON 请求类型，建立适合本地 UI/CLI 的 CSRF 或请求认证机制，覆盖合法 Vite 代理、生产同源和恶意简单 POST 回归。如果提供远程访问，还必须覆盖全部敏感 API（包括模型设置、自动任务和 DSH URL）的认证。不要仅修改 CORS 响应头。

### F3 / P1（公开发布）：未明确本项目源码许可证

`git ls-files '*LICENSE*' '*NOTICE*'` 无结果，根 package.json 无 license 字段。`private: true` 只是 npm 发布保护，并非源码许可声明。

人体资源已有署名与许可元数据：`3d-muscles/README.md:63`、`ASSET-DELIVERY.md` 及 runtime manifest 标注 CC BY-SA 2.1 Japan；不是完全没有来源记录。开源交付仍需明确本项目代码许可证，并单列第三方模型、Draco 等资源的许可与交付说明，不能把整个仓库笼统视为同一自选许可。本轮没有替所有者选择许可证，也没有进行完整许可合规审计。

### F4 / P1（可用性验收）：真实模型训练闭环仍缺证据

`docs/product/ONBOARDING.md` 与 `docs/dsh-integration/DSH-FITNESS-INTEGRATION.md:259` 明确未完成真实模型回复与业务写入验收。

本轮真实安装 Host + Chromium 的回归通过，但使用测试专用固定回复模型；首次凭据配置测试用虚构 Key。它们证明 Host、桥接、凭据保存和部分浏览器会话链路工作，不能证明模型能完成问答、摘要确认、计划 finalize、实际训练录入及恢复。

面向朋友试用前，应在独立工作区使用有效 Key 完成一次真实“空工作区 → 建档确认 → 首份计划 → 报告实际训练 → 正式 workout → 重启恢复”；自动计划另验一次文件校验后的业务成功。此处是发布验收要求，不建议在产品建档流程添加 Key 检查关卡。

### F5 / P2：当前提交 lint 失败，且新增支持脚本绑定作者机器

定位：`docs/dsh-integration/deepdive-java/support/reliability-probe.mts:2`。

`npm run lint` 实际失败：`readFile` 未使用。该文件第 5、6 行还从 `/root/liuchuan/trainng/...` 导入实现，朋友换目录后无法复现该文档支持脚本。它不是正式服务入口，但进入全局 lint，使 `npm run validate` 在第一步退出。

建议：删除未使用导入，使用可移植路径；将基础检查接入 CI。仓库当前没有已跟踪的 `.github` workflow。既有文档的“lint 通过”是早期基线证据，不覆盖 HEAD。

### F6 / P2：生产依赖审计有 1 high、1 moderate

执行 `npm audit --omit=dev --json`：2 个受影响包，0 critical。

- `js-yaml@4.2.0` 通过 DSH 等依赖进入生产树，high；审计命中 YAML CPU 消耗问题。[维护者公告](https://github.com/advisories/GHSA-2883-xcg3-v3hh)列出的修复版本包括 4.3.2。
- `three-stdlib` 下 `fflate@0.6.10`，moderate；[维护者公告](https://github.com/advisories/GHSA-px8p-9vwx-vf98)说明畸形 ZIP64 的解压死循环。

审计显示可修复，但本轮未升级依赖，也未证明具体漏洞在当前产品输入路径可达。建议做有范围的 lockfile 更新及 Host/3D 回归，避免直接强制升级全部依赖。

### F7 / P2：工作区 Git 防误提交只覆盖推荐用法

定位：`server/workspace-init.ts:37`、根 `.gitignore`。

默认 `.workspaces/` 被应用 Git 忽略，官方建议只在 `fitness/` 内建立个人 Git，这种用法正确。初始化只生成 `fitness/.gitignore`（tmp/bak/lock），没有工作区根 `.gitignore`。朋友若误在 WORKSPACE_ROOT 执行 git init + git add，config 凭据和 runtime 会话不会被自动排除；自选应用目录内其他工作区也需手动忽略。

建议：初始化生成工作区根保护规则，明确拒绝/提示容易污染应用仓库的路径；保持个人 fitness 数据 Git 与配置、凭据、聊天的备份边界清晰。

### F8 / P2：远程交付与使用文档存在缺口

- 服务以一个 WORKSPACE_ROOT 实例化数据存储、设置、Scheduler 和 Host，没有用户账号或请求级工作区切换。多浏览器访问同一个实例会使用同一份数据。
- Compose 默认只发布主机 loopback 端口；这是本地保护，不能据此承诺手机或朋友远程可用。`DshWebHost` 返回 Host 启动时给出的 URL，受控远程 origin 的 token/cookie/WebSocket/reconnect 仍需独立验收。
- README 的 npm 安装路径没有明确 Node/npm 支持版本、Windows/WSL 适用范围。脚本包含 POSIX 环境变量写法，Host profile 使用目录 symlink，本轮仅 Linux Node 24.14.0 / npm 11.9.0 验证。
- 文档冲突：`LOCAL-DEVELOPMENT.md:20` 仍称 DSH_PROVIDER/DSH_MODEL 覆盖有效；当前 `server/dsh-web-host.ts` 明确过滤这两个变量，权威 DSH 集成文档也说明已移除覆盖。Compose 仍列出两变量，容易误导。
- 架构文档还有旧 `fitness-os/` 路径和多色肌肉描述，与当前工作区及主题契约不一致。应按对应权威专题核对更新，不能让朋友从过期说明推断行为。

## 已确认有效的实现

- 应用公共 resources、templates、examples 与个人 fitness/config/runtime 分离；空初始化不复制事实数据、默认关闭自动计划。
- CLI 与服务共用路径推导，冲突环境变量拒绝执行，隔离工作区测试通过。
- 计划与 workout 生命周期分离；处方不能直接当成真实负重，重复提交和版本冲突有测试。
- 正式提交有 schema、计算、路径限制和原子写入；档案版本及计划修订冲突有防护。
- 数据刷新来自校验后的文件 revision，未把 DSH idle 当业务成功。
- DSH 官方凭据与普通设置分离；配置接口不返回 Key 原文。

这些是单人本地应用的有效基础，不等同于操作系统级 Agent 沙箱或多租户认证。

## 本轮验证

- 全新 HEAD 快照在独立临时目录运行 `npm ci --no-audit --no-fund`：通过，安装 900 packages。未复用当前 node_modules。
- 全新安装的 CLI init/validate：通过；正式 fitness 目录仅 manifest.yaml 与 .gitignore，校验结果 0 plans / 0 workouts。
- 单元/组件：50/50 通过。
- 集成：42/42 通过，包含真实已安装 DSH Host、Chromium、临时空工作区与首次凭据保存恢复。
- lint：失败，见 F5。
- architecture lint、design lint、typecheck、完整生产 build：通过。
- build 保留已有 Three 异步 chunk 大于 500 kB 提示；测试有多份 Three 实例 warning，均未隐藏。
- 三项 3D 校验：通过。source-map 检查使用本机已有离线源目录，不代表新克隆具备原始源资产。
- E2E：Chromium 单 worker 全量 23/23 通过（2.7 分钟），使用隔离工作区；不等同于真实模型或生产部署。
- 浏览器跨来源写入探针：确认存在缺陷，见 F2。
- 当前媒体只做针对性抽查，不声称 126 张图片全部脱敏审查完成。
- 本轮未执行新 Docker 镜像/Compose V2、生产域名、多设备部署、真实模型付费调用或跨平台验收。

## 发布前处理顺序建议

1. 修复跨来源写入和 lint，更新受影响依赖并回归。
2. 清理当前媒体/fixture/文档中的个人内容，明确代码与第三方资源许可，制作独立干净公开仓库。
3. 补齐可复制的本地安装说明与工作区 Git 防误提交，修正文档冲突。
4. 独立工作区完成真实模型建档、计划、训练和恢复验收。
5. 以“单人本地 Alpha”邀请少量朋友分别安装；远程共用服务另按已有发布拓扑 POC 推进。

这是此次审查的建议次序，不替换 AGENTS.md 路线图；没有执行公开仓库创建、历史重写或发布。
