# 数据分离与建档验收

## 交付范围与 review

2026-09-13，负责人拆分为工作区迁移、数据契约、UI／DSH 三组实现，随后交叉 review。已修复指标无法追加、实际记录静默接受处方、无效日期、旧导航路径、部分档案恢复、符号链接越界和计划提交版本竞争等问题。

- `WORKSPACE_ROOT` 统一推导 fitness、config、runtime、DSH_HOME；公共资源按安装位置解析。旧独立路径与工作区冲突会报错。
- 空初始化无个人事实、无案例、自动计划关闭；模型普通选择分区保存，Key 只由 DSH 管理。分区并发保存不会覆盖其他分区。
- 建档、偏好更新、周期、指标、新计划和计划修订均有 CLI 收口；新计划拒绝覆盖，修订核对原计划 SHA256，计划／周期发布与应用档案更新共用档案锁。
- 实际训练要求用户报告或明确确认；处方不能直接变为完成事实。未知负荷和无历史恢复以未知表示。

## 迁移与发布边界

已在应用仓库外的独立工作区迁移并校验，原业务文件移出当前应用树，本机被忽略的默认工作区链接至迁移目标。未创建个人 Git 仓库、commit、push 或改写应用 Git 历史。

- 53 份 workout、22 份 plan、29 份原始导入已保留；145 份原业务／档案文件与备份 SHA256 逐份一致，清单共 148 项（另含旧 Agent 文档与应用设置）。
- 48 个 workout 来源引用全部可解析；迁移后 `validate all` 通过，档案、周期和指标也进入正式校验。
- 原 runtime 122 个文件完整归档；旧 Session 绑定原工作区，保持归档且不冒充新工作区的可恢复会话。用户可另外恢复／核对旧会话。
- 计算语义版本 2：仅 10 份确实缺少负重／体重的 workout 更新 computed，总量由不完整数字变为 null 并记录缺失组数；刺激和恢复数值不变，事实字段哈希不变。逐条 old/new 在个人工作区 calculation-migration-report.json，未进入应用仓库。
- 原始备份、后台配置、凭据和迁移详细报告都在个人工作区，不在 fitness Git 备份单位中。当前树删除不消除 Git 历史，公开完整仓库前仍需另行审查历史及既有媒体附件。

## 自动验证与浏览器

- ESLint、架构检查、设计 token 检查、TypeScript、完整生产构建通过。
- 48 项单元／组件测试、39 项集成测试通过。覆盖 Host 异步退出后重启并重新读取模型设置、工作区隔离、跨 cwd CLI、档案版本冲突、计划修订冲突、并发重复提交、未知处方、Git 元数据排除、规则版本冲突和自动任务前置条件。
- 20 项 E2E 全部覆盖通过：隔离端口全量首次 17 项通过，3 项在并行构建／页面热更新期间失败；停止编辑与构建后单 worker 复验 3 项通过，没有增加超时或放宽断言。测试使用独立临时工作区，截图写入 test-results，避免覆盖用户已有审图文件。
- 真正空工作区 API 驱动的桌面 1440×1000、手机 390×844 建档截图已审查，无横向溢出。新增 onboarding-desktop.png、onboarding-mobile.png 使用合成空工作区。
- 合成案例通过同一 validate all（1 plan、0 workout），不会自动导入正式工作区。
- 三项 3D 校验通过：67 肌肉、18 分组，运行资产 2.18 MB。构建仍有已有的 Three chunk 大小提示，未调高警告阈值。

## Docker 与本机服务

最终 Node 22 镜像 `fitness-data-separation:verified` 的 ID 为
`sha256:d7cc1f6c7bc1d249217c5fddab7303366b04bead04c2e2e4df1773a147b34c1b`。
在全新空工作区、只读根文件系统、UID 1000、cap-drop ALL 和 no-new-privileges 下，
DSH Host 在第 16 秒已 ready，第 31、46、61 秒保持 ready，官方凭据设置 bridge 经 Fitness `/api/model/settings` 返回 HTTP 200。
未调用模型，不输出 token 或 Key。测试后先正常 docker stop，再删除容器。

真实容器验收发现并修复了仅在 profile 下链接 Fitness plugin 的安装缺陷：根 package.json 现明确声明两个本地 file 生产依赖，
lockfile 保持 link:true，Docker 依赖阶段预复制 plugin manifests，运行阶段复制完整 plugin 实现。
最终镜像从 `/app/node_modules/@deepseek-ai/cordis-plugin-loader/lib/index.js` 的真实解析起点，
可分别解析 automation-bridge 与 surface 到 `/app/dsh-fitness/` 下的 index.js，生产裁剪后链接仍有效。

复用曾强停的 debug 工作区时曾观察到官方 `dsh-credentials.yaml.lock` 等待超时；
这是遗留锁场景，不是插件加载成功的证据。本次最终验收改用全新工作区，未删除既有凭据或强行自动解锁。
故障恢复边界与正常停止升级顺序见部署 README。

负责人使用上述同一最终镜像另建全新工作区，独立验证：首次状态 empty → 正式 commit 虚构确认档案 → DSH ready → 正常 docker stop/rm → 重建后 profile_confirmed，档案字节不变、DSH 再次 ready、validate all 返回 0 plans / 0 workouts。镜像 /app/profile.yaml 与 /app/data 不存在，公共资源存在。测试采用只读根文件系统、独立 bind mount、UID 1000，容器已正常停止并删除；未执行生产部署。

依赖只在 dependencies 阶段安装，production-dependencies 离线移除开发依赖，运行镜像复用该结果；避免第二次网络下载。第一次运行依赖安装曾 ECONNRESET，改为上述结构后继续验证。当前机器无 Compose V2 插件，旧 docker-compose 不支持本仓库 name 字段，因此 Compose V2 拓扑未直接执行；等价 Docker daemon 参数下的只读挂载与重建恢复已验证。

本机既有服务已切换到迁移工作区，HTTP health、onboarding、dashboard 返回 200，DSH Host ready；未改动监听范围或开放公网端口。

## 当前限制

真实模型生成与写入受本机缺少模型 Key 阻塞，详细证据见下节。已确认档案和训练数据不受该错误影响，不增加 Key 正确性检查或建档连接关卡。生产域名／跨设备认证和旧 Session 迁移不在本轮已验证范围。

指标第一阶段身份规则为身体测量按日期、有氧按日期与类型；相同身份同值幂等，不同值拒绝覆盖。同一天多次同类型有氧需将来扩展 session ID。

## 真实 DSH Host 与请求上下文

验证日期：2026-09-13。使用已安装 DSH 0.1.2-alpha.3、独立临时工作区、虚构案例档案、新 DSH_HOME 和独立验收 Session；未操作原用户训练文件或聊天。验收使用现有官方凭据文件，不增加 Key 测试流程，不记录 Key 原文。

- Host 在独立 3185 / 3186 端口实际启动并进入 ready。正常浏览器的 token/cookie 握手未完成验证；直接 HTTP fetch 返回 401，不能以 Host ready 宣称浏览器登录成功。
- 通过受保护 loopback automation bridge 提交请求实际获得 HTTP 202。官方 Session persistence 的 request/header 已包含当前虚构档案和 SHA256 profile_revision。
- 第一轮档案 revision 为 `8d8575365595aea2d33f757890babe08422b28bfbf4956ccbe8c5ca8c3ddc0a6`。
- 修改隔离档案热身偏好后，恢复同一个验收 Session 再提交请求。第二个 request/header 包含新偏好，revision 为 `fa39f7acc81813b83366abed4125a17da2abfdd9e30173c90832a713031c01a6`，与文件重新计算的 SHA256 一致。确认上下文按请求重新读取，不依赖首轮会话缓存。
- 官方 LLM adapter 返回 `MISSING_CREDENTIAL`：`deepseek-official` 无 API Key。现有凭据文档只有浏览器会话记录，启动环境也未提供模型 Key。因此真实模型创建草稿、finalize 和后续训练数据写入闭环**未验证**。没有产生计划，未将 Agent idle 判定为业务成功。
- 所有本次启动的独立验收 Host 已关闭。未提交 Session 原始记录、请求完整正文、官方凭据或含 token 的 URL。

安装包核对：`dsh-credentials-local` 的 `Config.path` 支持自定义凭据文件；实际生成的 Host patch 将 `credentials` 路径指定到工作区 `config/dsh-credentials.yaml`，继续使用 DSH 官方格式与 0600 权限机制。
