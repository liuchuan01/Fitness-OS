# AI Fitness OS

[English](README.md) | **简体中文**

> [!NOTE]
> AI Fitness OS 目前还在预览阶段，我们正在一步步把它打磨得更好用。你想看到什么新功能，或是觉得哪里可以做得更好？欢迎到 [Issues](https://github.com/liuchuan01/Fitness-OS/issues) 分享点子，一起聊聊、一起完善！

**从身体出发，让每一次训练都有迹可循。**

最近练了哪里，下次想怎么练？转一转 3D 人体，点选肌群，回顾自己的训练，再和 AI 教练聊聊下一步。AI Fitness OS 原生集成 DeepSeek Harness，把身体探索、训练记录和教练对话放进同一个个人训练工作区。

应用在本机运行，档案、计划和训练记录都以可读的 YAML 文件保存在你自己的工作区里，方便查看，也方便备份。

[![AI Fitness OS 动态演示：探索肌肉、回顾训练与打开 AI 教练](https://github.com/user-attachments/assets/4f890d1b-42b3-45c1-9996-db6d3405ef00)](https://github.com/user-attachments/assets/db68d75e-9831-4c09-b095-4687b8032a9c)

[DSH 原生集成](#原生集成-deepseek-harness) · [快速开始](#快速开始) · [数据与备份](#数据与备份) · [开发与文档](#开发与文档)

## 原生集成 DeepSeek Harness

AI 教练背后是 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness)。应用通过专属 Fitness profile 启动持续运行的 DSH Host，你可以直接在训练工作区里与教练交流。

- **对话能力，原生接入。** 会话、历史记录、流式回复、工具调用、审批和断线恢复，都由 DSH 提供。
- **模型和思考强度，自己选。** 在配置页选择默认模型和它支持的思考强度。可用选项直接来自当前 DSH Host，选择也保存在 DSH 原生设置中。
- **日常交流和自动计划，各有安排。** 两者共用同一个 Host，但使用独立会话；定时任务的调度、重试和训练文件校验由 Fitness 负责。
- **训练记录，校验后再保存。** DSH 管理对话，Fitness 管理训练数据。AI 写出的草稿需要经过本地校验和按固定规则计算，才能成为正式记录。

想了解接入细节？当前仓库锁定 `@deepseek-ai/dsh@0.1.5-rc.2`，实现方式与验证范围见 [DSH 集成架构](docs/dsh-integration/DSH-FITNESS-INTEGRATION.md)。

## 在这里，你可以

- **点到哪里，就看看哪里练过。** 旋转 3D 人体，选中感兴趣的肌群，查看相关动作和训练历史。
- **翻翻自己的训练足迹。** 沿着时间线回顾每次训练，动作、组数、次数和负重都能找到。
- **和 AI 教练聊出自己的训练安排。** 从目标、经验、手边的器械和可用时间聊起，一起建立档案、讨论计划。想练什么、实际练了什么，分别记录。
- **把数据握在自己手里。** 个人记录独立于应用仓库，随时可以备份，也可以交给自己的私有 Git 仓库管理。
- **换上喜欢的外观。** Neon 和 Graphite 两套主题随你切换，桌面和手机窄屏都有对应布局。

目前适合**一个人在本机上尝鲜**，界面和大部分文档以中文为主。使用 AI 教练需要联网，并准备有效的模型 API Key；对话所需的上下文会发送给模型服务。

## 快速开始

准备好 Git 和 Node.js，就可以开始了。我们在 **Linux、Node.js 24、npm 11** 环境下做过本地验证，下面的命令请在 Bash 中执行：

```bash
git clone https://github.com/liuchuan01/Fitness-OS.git
cd Fitness-OS
npm ci

# 将个人数据放在代码仓库之外
export WORKSPACE_ROOT="$HOME/my-fitness-workspace"
npm run fitness -- init
npm run dev
```

启动后，打开 **[http://127.0.0.1:5173](http://127.0.0.1:5173)** 就能看到首页。使用期间让终端保持运行，结束时按 `Ctrl+C` 即可。

下次打开新终端时，记得先设置同一个 `WORKSPACE_ROOT`，这样才能回到自己的工作区。如果省略这一步，应用会使用仓库里的 `.workspaces/default`，你可能会看到一个空白工作区。

你的工作区会从空白开始，不会混入案例档案或训练记录，自动计划也默认关闭。想先看看数据长什么样？可以逛逛[虚构案例工作区](examples/fitness-starter/README.md)。

习惯用 Docker？跟着 [Docker 部署说明](deploy/README.md)操作即可。服务默认只监听本机地址，从其他设备访问需要额外配置，目前还不支持多人共享账号。

## 第一次用，从这里开始

1. **先接上 AI 教练。** 打开**配置后台 → 模型连接**，在 **DeepSeek Harness** 区域填入自己的 DeepSeek API Key。还没准备好 Key 也没关系，可以先转转人体、熟悉界面。
2. **选好模型和思考强度。** 可用选项取决于 DSH 提供的模型能力。保存后，新对话和新建的自动任务会话会使用这份默认设置，已有会话则保留原来的选择。
3. **让教练认识你。** 回到首页，点击**建立我的训练档案**，聊聊自己的目标、训练经验、能腾出的时间，以及手边有哪些器械。
4. **一起安排第一练。** 确认档案摘要后，和教练讨论首份计划。练完再告诉教练实际完成了什么，计划和训练记录会分别保存。

需要更详细的步骤，可以看[首次建档与首训](docs/product/ONBOARDING.md)。目前本地服务、数据校验和浏览器流程已有自动化回归测试；使用真实模型完成整套建档与文件写入，以及生产部署，还没有完成验收。具体进展见 [DSH 集成记录](docs/dsh-integration/DSH-FITNESS-INTEGRATION.md)。

## 数据与备份

代码归代码，你的训练数据有自己的家：

```text
my-fitness-workspace/
├── fitness/   # 个人档案、计划、实际训练记录与身体指标
├── config/    # 应用设置与模型凭据
└── runtime/   # DSH 设置与会话、调度状态、建档草稿
```

默认模型与思考强度使用 `runtime/dsh/settings.yaml` 中 DSH 原生的 `agent-default-model` 设置。API 凭据单独存放在 `config/dsh-credentials.yaml`；通过环境变量提供的凭据在界面中保持只读。

只想备份正式训练数据？保留 `fitness/` 就可以。设置、凭据和聊天也想一起留住，则需要另外备份 `config/` 和 `runtime/`。聊天能否恢复还取决于 DSH 版本和原工作区路径，单纯复制文件不一定能恢复。

如果你习惯用 Git，可以只在 `fitness/` 里建立**私有仓库**，自己掌握记录的版本。应用不会自动提交或推送；请把凭据、聊天和整个个人工作区留在公开仓库之外。

带着旧版记录升级？先做好备份，再按[迁移与恢复说明](docs/dsh-integration/LOCAL-DEVELOPMENT.md#其他机器升级时保留记录)操作。更新应用代码时，个人数据不会自动同步。

## 开发与文档

想一起动手完善项目？前端使用 React、TypeScript、Vite 和 Three.js，本地 Node.js 服务负责 YAML 校验、计算和训练文件写入，DeepSeek Harness 提供 Agent Host 和会话能力。可以从下面这些目录开始：

| 目录                    | 内容                                |
| ----------------------- | ----------------------------------- |
| `src/`                  | 前端页面、交互和 3D 人体            |
| `server/`、`shared/`    | 本地服务、共享类型与数据契约        |
| `dsh-fitness/`          | DSH profile、对话界面与自动任务桥接 |
| `public/`、`resources/` | 静态资源与公共训练规则              |
| `tooling/`、`tests/`    | 构建配置与自动化测试                |
| `docs/`                 | 产品、设计、数据与工程文档          |

常用命令均在项目根目录运行：

```bash
npm run dev          # 同时启动前端与本地服务
npm run build        # 构建前端和服务端
npm run typecheck    # TypeScript 检查
npm test             # 单元与组件测试
```

本地 API 默认使用端口 `8787`，DSH Host 使用端口 `3080`。更多说明见以下文档（主要为中文）：

- [本地运行与数据迁移](docs/dsh-integration/LOCAL-DEVELOPMENT.md)
- [DSH 原生集成架构](docs/dsh-integration/DSH-FITNESS-INTEGRATION.md)
- [数据契约与 CLI](docs/data/FITNESS-DATA-ARCHITECTURE.md)
- [结构模板](templates/fitness/)与[虚构案例](examples/fitness-starter/README.md)
- [技术架构](docs/engineering/TECHNICAL-ARCHITECTURE.md)与[编码规范](docs/engineering/CODING-STANDARDS.md)
- [贡献前的项目导航与路线图](AGENTS.md)

## 许可证

原创源码与文档采用 [Apache License 2.0](LICENSE)。人体模型等第三方资源保留独立许可，详见[第三方资源说明](docs/engineering/THIRD-PARTY-NOTICES.md)。
