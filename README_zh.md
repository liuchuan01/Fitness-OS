# AI Fitness OS

[English](README.md) | **简体中文**

**原生集成 DeepSeek Harness，以身体为入口的个人训练工作区。**

在交互式 3D 人体上探索训练，回顾每次运动，与 AI 教练一起安排下一步。AI Fitness OS 在本机运行，将个人档案、计划和训练记录保存为自己工作区中可读的 YAML 文件。

![AI Fitness OS 首页：交互式 3D 人体、训练时间线与肌肉活动](docs/index.png)

[DSH 原生集成](#原生集成-deepseek-harness) · [快速开始](#快速开始) · [数据与备份](#数据与备份) · [开发与文档](#开发与文档)

## 原生集成 DeepSeek Harness

[DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 是 AI Fitness OS 的核心 Agent 运行时。应用通过专属 Fitness profile 启动长期运行的 DSH Host，将其对话界面融入训练工作区。

- **原生会话与工具。** Session、历史、流式回复、工具调用、审批和断线恢复均由 DSH 承载。
- **模型与思考强度可选。** 在配置页选择默认模型及其支持的思考强度。模型目录和可用选项直接来自运行中的 DSH Host，偏好通过 DSH 原生设置保存。
- **教练与自动计划共用 Host。** 交互对话和定时规划使用同一个 Host、各自独立的 Session；Fitness 负责调度、重试及训练文件的结果校验。
- **明确的数据边界。** DSH 管理对话，Fitness 管理训练数据。Agent 草稿经过本地校验和确定性计算，才能成为正式训练记录。

当前仓库锁定 `@deepseek-ai/dsh@0.1.5-rc.2`。实现细节与验证范围见 [DSH 集成架构](docs/dsh-integration/DSH-FITNESS-INTEGRATION.md)。

## 可以做什么

- **从人体回顾训练。** 旋转 3D 人体、选择肌群，查看相关动作与训练历史。
- **查看每一次训练。** 通过时间线回顾动作、组数、次数和负重。
- **与 AI 教练一起建档。** 交流目标、经验、器械和可用时间，再讨论训练安排；计划与实际完成记录分别保存。
- **保留自己的数据。** 个人记录与应用仓库分离，可以独立备份，也可以用私有 Git 仓库管理。
- **选择喜欢的外观。** 内置 Neon 与 Graphite 两套主题，支持桌面与窄屏布局。

当前定位是**单人本地试用**，界面及大部分项目文档使用中文。AI 对话需要联网和有效的模型 API Key，相关对话上下文会发送至模型服务。

## 快速开始

本地验证环境为 **Linux、Node.js 24、npm 11**。准备好 Git 和 Node.js，以下命令在 Bash 中执行：

```bash
git clone https://github.com/liuchuan01/Fitness-OS.git
cd Fitness-OS
npm ci

# 将个人数据放在代码仓库之外
export WORKSPACE_ROOT="$HOME/my-fitness-workspace"
npm run fitness -- init
npm run dev
```

打开 **[http://127.0.0.1:5173](http://127.0.0.1:5173)**，保持终端运行；退出时按 `Ctrl+C`。

以后在新终端中启动，也请先设置同一个 `WORKSPACE_ROOT`。未设置时，应用使用仓库内的 `.workspaces/default`，因此可能看到另一个空工作区。

初始化不会导入案例档案或训练记录，自动计划默认关闭。想先了解数据格式，可以查看[虚构案例工作区](examples/fitness-starter/README.md)。

偏好容器运行？请看 [Docker 部署说明](deploy/README.md)。服务默认监听本机地址；其他设备访问需要额外配置，当前不支持多人共享账号。

## 首次使用

1. 打开**配置后台 → 模型连接**，在 **DeepSeek Harness** 区域填写自己的 DeepSeek API Key。未配置 Key 时仍可探索人体，AI 教练需要有效 Key。
2. 按需选择默认模型与思考强度，可用选项取决于 DSH 返回的模型能力。保存后用于新会话，包括新建的自动任务会话；已有会话保留各自的选择。
3. 回到首页，点击**建立我的训练档案**，与教练交流目标、训练经验、时间和器械条件。
4. 核对档案摘要并讨论首份计划；训练后报告实际完成情况，让计划与真实训练记录保持区分。

详细流程见[首次建档与首训](docs/product/ONBOARDING.md)。本地服务、数据校验和浏览器流程已有自动回归；完整真实模型建档与文件写入、生产部署仍未完成验收，验证范围见 [DSH 集成记录](docs/dsh-integration/DSH-FITNESS-INTEGRATION.md)。

## 数据与备份

应用代码与个人数据分别管理：

```text
my-fitness-workspace/
├── fitness/   # 个人档案、计划、实际训练记录与身体指标
├── config/    # 应用设置与模型凭据
└── runtime/   # DSH 设置与会话、调度状态、建档草稿
```

默认模型与思考强度使用 `runtime/dsh/settings.yaml` 中 DSH 原生的 `agent-default-model` 设置。API 凭据单独存放在 `config/dsh-credentials.yaml`；通过环境变量提供的凭据在界面中保持只读。

备份 `fitness/` 可以保留正式训练数据；如果还要保留设置、凭据和聊天，请分别备份 `config/` 与 `runtime/`。聊天恢复取决于 DSH 版本和原工作区路径，不能仅凭复制文件保证恢复。

你可以只在 `fitness/` 中建立**私有 Git 仓库**。应用不会自动提交或推送；凭据、聊天和整个个人工作区不应加入公开仓库。

从旧版升级且已有记录时，请先备份，再按[迁移与恢复说明](docs/dsh-integration/LOCAL-DEVELOPMENT.md#其他机器升级时保留记录)操作。个人数据不会随应用代码自动同步。

## 开发与文档

前端使用 React、TypeScript、Vite 和 Three.js；本地 Node.js 服务负责 YAML 校验、计算和训练文件写入，DeepSeek Harness 提供 Agent Host 与会话。

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
