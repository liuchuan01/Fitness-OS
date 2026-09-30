# AI Fitness OS

**English** | [简体中文](README_zh.md)

> [!NOTE]
> AI Fitness OS is still in preview, and we’re making it better step by step. Have a feature in mind or an idea for improving the experience? Share it in [Issues](https://github.com/liuchuan01/Fitness-OS/issues)—let’s discuss it and build this together!

**Start with your body. Keep track of every workout.**

What have you trained lately? What would you like to work on next? Rotate the 3D body, pick a muscle group, revisit your workouts, and talk through your next steps with an AI coach. Built natively on DeepSeek Harness, AI Fitness OS brings body exploration, training records, and coaching conversations into one personal fitness workspace.

The app runs locally. Your profile, plans, and workout records live in your own workspace as readable YAML files, ready to browse and back up.

[![AI Fitness OS demo: explore muscles, review workouts, and open the AI coach](https://github.com/user-attachments/assets/4f890d1b-42b3-45c1-9996-db6d3405ef00)](https://github.com/user-attachments/assets/db68d75e-9831-4c09-b095-4687b8032a9c)

[Watch the full demo (33 seconds)](https://github.com/user-attachments/assets/db68d75e-9831-4c09-b095-4687b8032a9c)

[Native DSH integration](#native-deepseek-harness-integration) · [Quick start](#quick-start) · [Your data](#your-data) · [Development](#development)

## Native DeepSeek Harness integration

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) powers the AI coach. The app starts a persistent DSH Host with a dedicated Fitness profile, so you can talk with your coach right inside your training workspace.

- **Conversations and tools, built in.** DSH provides sessions, history, streaming responses, tool calls, approvals, and reconnection.
- **Your choice of model and reasoning effort.** Pick a default model and a supported reasoning effort in Settings. Available options come straight from the current DSH Host, and your choices are saved in DSH’s native settings.
- **Room for both coaching and scheduled plans.** They share one Host while keeping separate sessions. Fitness handles task scheduling, retries, and validation of training files.
- **Training records checked before they’re saved.** DSH manages conversations; Fitness manages training data. AI drafts pass through local validation and rule-based calculations before becoming official records.

For a closer look at the integration and what has been validated, see the [DSH integration architecture](docs/dsh-integration/DSH-FITNESS-INTEGRATION.md). The repository currently pins `@deepseek-ai/dsh` to `0.1.5-rc.2`.

## What you can do

- **Pick a muscle group and see what you’ve trained.** Rotate the 3D body, select an area that interests you, and explore related exercises and workout history.
- **Look back at your training.** Follow the timeline to revisit each workout, down to the exercises, sets, reps, and weights.
- **Talk through a plan with your AI coach.** Start with your goals, experience, available equipment, and schedule. Build your profile and discuss a plan together, with separate records for what you intend to do and what you actually complete.
- **Keep your data in your hands.** Personal records live outside the app repository. Back them up whenever you like, or manage them in your own private Git repository.
- **Choose a look you enjoy.** Switch between Neon and Graphite, with layouts for both desktop and smaller phone screens.

For now, the preview is for **one person trying it out locally**. The interface and most documentation are in Chinese. AI coaching needs an internet connection and a valid model API key; the context needed for the conversation is sent to the model provider.

## Quick start

With Git and Node.js installed, you’re ready to get started. We’ve validated the app locally on **Linux, Node.js 24, and npm 11**. Run the following commands in Bash:

```bash
git clone https://github.com/liuchuan01/Fitness-OS.git
cd Fitness-OS
npm ci

# Keep personal data outside the application repository
export WORKSPACE_ROOT="$HOME/my-fitness-workspace"
npm run fitness -- init
npm run dev
```

Once the app starts, open **[http://127.0.0.1:5173](http://127.0.0.1:5173)** to see the home page. Leave the terminal running while you use it, then press `Ctrl+C` when you’re done.

Next time you open a terminal, remember to set the same `WORKSPACE_ROOT` to return to your workspace. If you skip this step, the app uses `.workspaces/default` inside the repository, and you may find yourself in an empty workspace.

Your workspace starts fresh, without sample profiles or workouts, and scheduled planning is off by default. To get a feel for the data format, take a look around the [fictional example workspace](examples/fitness-starter/README.md).

If you prefer Docker, follow the [Docker guide](deploy/README.md). Services listen on localhost by default, so access from other devices needs extra configuration. Shared multi-user accounts aren’t supported yet.

## Your first session

1. **Connect your AI coach.** Open **Settings (配置后台) → Model connection (模型连接)** and enter your DeepSeek API key under **DeepSeek Harness**. If you don’t have a key ready, you can still explore the body and get familiar with the interface.
2. **Choose a model and reasoning effort.** Available options depend on the model capabilities provided by DSH. Once saved, these defaults apply to new conversations and newly created automation sessions. Existing sessions keep their previous choices.
3. **Let your coach get to know you.** Go back to the home page and choose **Create my training profile (建立我的训练档案)**. Share your goals, training experience, the time you can set aside, and the equipment you have available.
4. **Plan your first workout together.** Confirm your profile summary, then discuss a first plan with the coach. After your workout, tell the coach what you actually completed. Plans and workout records are saved separately.

For more detailed steps, see the [onboarding guide](docs/product/ONBOARDING.md). Automated regression tests cover local services, data validation, and browser flows. The full onboarding and file-writing flow with a real model, as well as production deployment, still await acceptance testing. You can follow the progress in the [DSH integration record](docs/dsh-integration/DSH-FITNESS-INTEGRATION.md).

## Your data

Your training data has a home of its own, separate from the app code:

```text
my-fitness-workspace/
├── fitness/   # Profile, plans, completed workouts, and body metrics
├── config/    # Application settings and model credentials
└── runtime/   # DSH settings and sessions, scheduler state, onboarding drafts
```

Model and reasoning defaults use DSH's native `agent-default-model` settings in `runtime/dsh/settings.yaml`. API credentials are stored separately in `config/dsh-credentials.yaml`; environment-provided credentials remain read-only in the UI.

Back up `fitness/` to keep your official training records. To save settings, credentials, and conversations too, also back up `config/` and `runtime/`. Conversation recovery depends on the DSH version and original workspace paths, so copying files alone may not restore your chats.

If Git is part of your workflow, you can create a **private repository** inside `fitness/` and manage your record history yourself. The app won’t commit or push automatically. Keep credentials, conversations, and the full personal workspace out of public repositories.

When upgrading with existing records, make a backup first, then follow the [migration and recovery guide](docs/dsh-integration/LOCAL-DEVELOPMENT.md#其他机器升级时保留记录). Updating the app code won’t automatically sync your personal data.

## Development

If you’d like to help build the project, here’s where to start. The frontend uses React, TypeScript, Vite, and Three.js. A local Node.js service validates YAML, runs calculations, and writes training files, while DeepSeek Harness provides the Agent Host and sessions. These directories are a good starting point:

| Directory               | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| `src/`                  | Frontend, interactions, and 3D body             |
| `server/`, `shared/`    | Local service, shared types, data contracts     |
| `dsh-fitness/`          | DSH profile, conversation UI, automation bridge |
| `public/`, `resources/` | Static assets and shared training rules         |
| `tooling/`, `tests/`    | Build configuration and automated tests         |
| `docs/`                 | Product, design, data, and engineering docs     |

Run commands from the repository root:

```bash
npm run dev          # Start frontend and local service
npm run build        # Build frontend and server
npm run typecheck    # Check TypeScript
npm test             # Run unit and component tests
```

The local API uses port `8787`; the DSH Host uses port `3080` by default. Further documentation (primarily Chinese):

- [Local development and migration](docs/dsh-integration/LOCAL-DEVELOPMENT.md)
- [Native DSH integration](docs/dsh-integration/DSH-FITNESS-INTEGRATION.md)
- [Data architecture and CLI](docs/data/FITNESS-DATA-ARCHITECTURE.md)
- [Data templates](templates/fitness/) and [fictional examples](examples/fitness-starter/README.md)
- [Technical architecture](docs/engineering/TECHNICAL-ARCHITECTURE.md) and [coding standards](docs/engineering/CODING-STANDARDS.md)
- [Contributor instructions and roadmap](AGENTS.md)

## License

Original source code and documentation are licensed under [Apache License 2.0](LICENSE). Third-party assets, including the body model, retain their own licenses; see [third-party notices](docs/engineering/THIRD-PARTY-NOTICES.md).
