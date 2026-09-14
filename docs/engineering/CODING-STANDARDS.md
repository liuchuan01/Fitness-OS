# AI Fitness OS 编码规范

本文是人类开发者和后续 AI 修改本仓库时必须遵守的工程约束。优先级低于产品与数据契约文档，高于个人编码偏好。

## 1. 修改流程

1. 修改前阅读 `AGENTS.md` 及其指向的权威文档。
2. 先确认业务边界、数据契约和测试，再修改实现。
3. 保持改动聚焦；不得顺手改变无关业务、视觉或数据。
4. 完成后至少执行 `npm run lint`、`npm run lint:architecture`、`npm run typecheck` 和相关测试。
5. 涉及运行时、构建或 3D 时必须执行 `npm run build`；涉及交互时执行 E2E。
6. 将新的长期决策和踩坑写入 `docs/`，不得只留在聊天或注释中。

## 2. 目录与依赖方向

```text
src/main.tsx
  -> src/app               页面编排、跨功能 UI 状态
      -> src/features      按业务能力纵向组织
          -> src/components  无业务含义的共享展示组件
          -> src/api         类型化 HTTP 边界
              -> shared      前后端共享契约

server
  -> shared
  -> data
```

硬性规则：

- `src/` 不得导入 `server/`，`server/` 不得导入 `src/`。
- `shared/` 不依赖 React、DOM、Node 文件系统或服务实现。
- `shared/fitness/` 按 schema、纯计算与 projection 拆分；测试样例放在 `tests/fixtures/`，不得回流到生产领域模块。
- Three.js、R3F、Drei 只能位于 `src/features/body-3d/`。
- 重型可选功能必须通过动态 `import()` 建立加载边界；不得从入口同步导入 3D。
- 已移除的历史 3D demo 不得恢复、引用或作为新功能实现基础。
- 功能私有代码放在功能目录内；只有两个以上功能使用且语义稳定时才提升为共享组件。

## 3. 文件与组件

- `app/*.tsx` 不超过 300 行，`features/*.tsx` 不超过 320 行，`api/*.ts` 不超过 200 行；由 `lint:architecture` 检查。
- 一个组件只承担一种主要职责：数据协调、页面编排、展示或底层渲染，不混合多层职责。
- 页面组件不直接解析 API payload；解析由 `src/api/schemas.ts` 完成。
- 不创建只有转发 props、没有边界价值的组件。
- 公共 props、API 返回值和领域对象必须命名类型；局部一次性 props 可就近声明。
- 使用语义化 HTML、可访问名称和原生交互元素，不用 `div` 模拟按钮。

## 4. TypeScript

- 开启并维持严格模式；禁止显式 `any`、`@ts-ignore` 和无解释的类型断言。
- 仅作为类型使用的导入必须写 `import type`。
- 外部输入一律视为 `unknown`，在边界使用 Zod 校验后进入领域层。
- 优先使用可辨识联合与精确领域类型，避免布尔参数组合表达状态。
- 不复制 canonical muscle id、API schema 或计算规则；它们必须有唯一来源。
- 函数命名使用动词，布尔值使用 `is`、`has`、`can`、`should` 前缀。

## 5. React 与异步状态

- 派生值用纯函数或 `useMemo`，不得用 Effect 同步可计算状态。
- Effect 中的请求必须支持取消；快速切换不得让旧响应覆盖新状态。
- 业务数据请求集中在 feature hook 或 query 层，展示组件不发请求。
- 不静默吞掉非预期错误；用户可恢复的错误应转成明确 UI 状态。
- `lazy` 组件必须提供稳定、可访问的 `Suspense` fallback。
- 不以全局 store 代替清晰的局部状态；只有跨远距离功能共享时才引入 Zustand。

## 6. API、服务与数据

- 前端只通过 `src/api/` 访问本地服务。
- HTTP 状态、JSON 解析和 Zod 校验在 API 边界统一处理。
- AI 只产出 draft；schema 校验、确定性计算和文件写入由本地服务完成。
- YAML 是当前唯一数据源；写入必须原子化，覆盖已有文件前保留备份。
- 计划不维护生命周期状态；完成训练生成真实 workout，原计划保持不变。
- 不改变计算公式或 schema 而不更新权威文档与固定样例测试。

## 7. 3D

- 运行时只加载处理后的 Draco GLB，不批量加载 STL。
- 模型映射只使用 canonical muscle id 和 `body-model-contract.json`。
- 资产加载、场景渲染、材质绑定和产品 HUD 应保持模块分离。
- 资源和元数据失败必须有 fallback；WebGL 不可用时页面仍可使用。
- 修改模型、材质映射或交互后执行全部 `validate:3d-*` 命令。

## 8. 测试与提交质量

- 纯计算写单元测试，文件/API 闭环写集成测试，关键用户路径写 E2E。
- 修复缺陷时先添加能复现缺陷的测试，或在交付说明中解释为何无法自动化。
- 测试断言用户可见行为或稳定契约，不依赖内部实现细节。
- 不通过提高 warning 阈值、跳过检查或删除断言来“修复”构建。
- 不提交构建产物、测试报告、临时文件、密钥或本机绝对路径。

## 9. AI 输出要求

后续 AI 在交付时必须说明：

- 改了什么边界或行为；
- 执行了哪些验证及结果；
- 是否存在未解决风险；
- 涉及的关键文件位置。

若无法满足必需验证，不得声称工作已完成，必须明确阻塞条件。
