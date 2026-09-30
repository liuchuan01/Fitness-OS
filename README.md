# AI Fitness OS

**English** | [简体中文](README_zh.md)

**A personal fitness workspace built natively on DeepSeek Harness, with your body as the interface.**

Explore your training through an interactive 3D body, revisit workouts, and work with an AI coach on what comes next. AI Fitness OS runs locally and keeps your profile, plans, and training records in readable YAML files in your own workspace.

![AI Fitness OS: interactive 3D body, training timeline, and muscle activity](docs/index.png)

[Native DSH integration](#native-deepseek-harness-integration) · [Quick start](#quick-start) · [Your data](#your-data) · [Development](#development)

## Native DeepSeek Harness integration

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) is the Agent runtime at the heart of AI Fitness OS. The application starts a persistent DSH Host with a dedicated Fitness profile and integrates its conversation interface into the training workspace.

- **Native conversations and tools.** Sessions, history, streaming responses, tool calls, approvals, and reconnect are handled by DSH.
- **Model and reasoning controls.** Choose a default model and its supported reasoning effort in Settings. The model catalog and available options come directly from the running DSH Host; preferences are saved through DSH's native settings.
- **One Host for coaching and automation.** Interactive coaching and scheduled planning use the same Host with separate sessions. Fitness handles scheduling, retries, and validation of the resulting training files.
- **A clear data boundary.** DSH owns conversations; Fitness owns training data. Local validation and deterministic calculations turn Agent drafts into verified fitness records.

The repository currently pins `@deepseek-ai/dsh` to `0.1.5-rc.2`. See the [DSH integration architecture](docs/dsh-integration/DSH-FITNESS-INTEGRATION.md) for implementation details and validation scope.

## What you can do

- **Explore training on your body.** Rotate the 3D model, select a muscle group, and inspect related exercises and training history.
- **Revisit each workout.** Use the timeline to review exercises, sets, reps, and weights.
- **Build a profile with your AI coach.** Discuss goals, experience, equipment, and availability, then work toward a training plan. Plans and completed workouts remain separate records.
- **Keep your own data.** Store personal records outside the application repository, back them up, or manage them in a private Git repository.
- **Make the workspace yours.** Choose Neon or Graphite, with layouts for desktop and narrow screens.

The current release is for **single-user local use**. The interface and most project documentation are currently in Chinese. AI conversations require network access and a valid model API key; relevant conversation context is sent to the model provider.

## Quick start

The locally validated environment is **Linux, Node.js 24, and npm 11**. Install Git and Node.js, then run these commands in Bash:

```bash
git clone https://github.com/liuchuan01/Fitness-OS.git
cd Fitness-OS
npm ci

# Keep personal data outside the application repository
export WORKSPACE_ROOT="$HOME/my-fitness-workspace"
npm run fitness -- init
npm run dev
```

Open **[http://127.0.0.1:5173](http://127.0.0.1:5173)**. Keep the terminal running; press `Ctrl+C` to stop.

Set the same `WORKSPACE_ROOT` whenever you start the app in a new terminal. Without it, the app uses `.workspaces/default` inside the repository, which may show a different, empty workspace.

Initialization does not import sample profiles or workouts. Scheduled planning is off by default. Browse the [fictional example workspace](examples/fitness-starter/README.md) to see the data format.

For containers, see the [Docker guide](deploy/README.md). Services listen on localhost by default; access from another device requires additional configuration. Shared multi-user accounts are not supported.

## First session

1. Open **Settings (配置后台) → Model connection (模型连接)**. Under **DeepSeek Harness**, enter your DeepSeek API key. You can explore the body without a key; AI coaching requires one.
2. Select a default model and reasoning effort if desired. Options depend on the model capabilities reported by DSH. Saved defaults apply to new sessions, including newly created automation sessions; existing sessions keep their own selections.
3. Return to the home page and choose **Create my training profile (建立我的训练档案)**. Discuss your goals, experience, available time, and equipment with the coach.
4. Review the profile summary and discuss your first plan. After training, report what you actually completed so planned and performed workouts stay distinct.

See the [onboarding guide](docs/product/ONBOARDING.md) for the full flow. Local service, data validation, and browser flows have automated regression coverage. Full onboarding and file writes with a real model, and production deployment, have not yet completed acceptance testing; see the [validation record](docs/dsh-integration/DSH-FITNESS-INTEGRATION.md).

## Your data

Application code and personal data live separately:

```text
my-fitness-workspace/
├── fitness/   # Profile, plans, completed workouts, and body metrics
├── config/    # Application settings and model credentials
└── runtime/   # DSH settings and sessions, scheduler state, onboarding drafts
```

Model and reasoning defaults use DSH's native `agent-default-model` settings in `runtime/dsh/settings.yaml`. API credentials are stored separately in `config/dsh-credentials.yaml`; environment-provided credentials remain read-only in the UI.

Back up `fitness/` to preserve your training records. Back up `config/` and `runtime/` separately if you also need settings, credentials, and conversations. Restoring conversations depends on the DSH version and original workspace paths; copying files alone does not guarantee recovery.

You can initialize a **private Git repository** inside `fitness/`. The app does not commit or push automatically. Keep credentials, conversations, and the full personal workspace out of public repositories.

Upgrading with existing records? Back up first and follow the [migration and recovery guide](docs/dsh-integration/LOCAL-DEVELOPMENT.md#其他机器升级时保留记录). Personal data does not sync with application code.

## Development

React, TypeScript, Vite, and Three.js power the frontend. A local Node.js service validates YAML, performs calculations, and manages fitness file writes. DeepSeek Harness provides the Agent Host and sessions.

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
