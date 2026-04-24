import { isPlanModeInterviewPhaseEnabled } from '../../utils/planModeV2.js'
import { ASK_USER_QUESTION_TOOL_NAME } from '../AskUserQuestionTool/prompt.js'

const WHAT_HAPPENS_SECTION = `## 计划模式中会发生什么

在计划模式中，你将：
1. 使用 Glob、Grep 和 Read 工具彻底探索代码库
2. 理解现有的模式和架构
3. 设计实现方案
4. 将计划呈现给用户以获得审批
5. 如需澄清方案，使用 ${ASK_USER_QUESTION_TOOL_NAME}
6. 准备好实现时，使用 ExitPlanMode 退出计划模式

`

function getEnterPlanModeToolPromptExternal(): string {
  // When interview phase is enabled, omit the "What Happens" section —
  // detailed workflow instructions arrive via the plan_mode attachment (messages.ts).
  const whatHappens = isPlanModeInterviewPhaseEnabled()
    ? ''
    : WHAT_HAPPENS_SECTION

  return `在即将开始非简单实现任务时，请主动使用此工具。在编写代码前获得用户对方案的认可，可以避免无效工作并确保方向一致。此工具将你切换到计划模式，让你可以探索代码库并设计实现方案以供用户审批。

## 何时使用此工具

除非任务很简单，否则**优先使用 EnterPlanMode**。当符合以下**任一**条件时使用：

1. **新功能实现**：添加有意义的新功能
   - 示例："添加退出登录按钮"——应放在哪里？点击后应发生什么？
   - 示例："添加表单验证"——规则是什么？错误提示是什么？

2. **多种有效方案**：任务可以用几种不同方式实现
   - 示例："为 API 添加缓存"——可以用 Redis、内存缓存、文件缓存等
   - 示例："提升性能"——有多种优化策略

3. **代码修改**：影响现有行为或结构的变更
   - 示例："更新登录流程"——具体需要改什么？
   - 示例："重构此组件"——目标架构是什么？

4. **架构决策**：任务需要在模式或技术之间做出选择
   - 示例："添加实时更新"——WebSockets vs SSE vs 轮询
   - 示例："实现状态管理"——Redux vs Context vs 自定义方案

5. **多文件变更**：任务可能涉及超过 2-3 个文件
   - 示例："重构认证系统"
   - 示例："添加带测试的新 API 端点"

6. **需求不明确**：在理解完整范围之前需要先探索
   - 示例："让应用更快"——需要先分析并找出瓶颈
   - 示例："修复结账中的 bug"——需要调查根本原因

7. **用户偏好很重要**：实现可能有多种合理方向
   - 如果你会使用 ${ASK_USER_QUESTION_TOOL_NAME} 来澄清方案，请改用 EnterPlanMode
   - 计划模式允许你先探索，再结合上下文呈现选项

## 何时不应使用此工具

仅对以下简单任务跳过 EnterPlanMode：
- 单行或少量行的修复（拼写错误、明显的 bug、小调整）
- 添加需求明确的单个函数
- 用户已给出非常具体、详细的指令的任务
- 纯粹的研究/探索任务（请改用 Agent 工具的 explore 代理）

${whatHappens}## 示例

### 正确——使用 EnterPlanMode：
用户："为应用添加用户认证"
- 需要架构决策（session vs JWT、token 存储位置、中间件结构）

用户："优化数据库查询"
- 有多种方案，需要先分析，影响较大

用户："实现深色模式"
- 主题系统的架构决策，影响许多组件

用户："在用户资料中添加删除按钮"
- 看似简单，但涉及：放置位置、确认弹窗、API 调用、错误处理、状态更新

用户："更新 API 中的错误处理"
- 影响多个文件，用户应审批方案

### 错误——不要使用 EnterPlanMode：
用户："修复 README 中的拼写错误"
- 直接明了，无需计划

用户："添加 console.log 来调试此函数"
- 简单，实现方式显而易见

用户："哪些文件处理路由？"
- 研究任务，不是实现规划

## 重要说明

- 此工具需要用户审批——他们必须同意进入计划模式
- 如果不确定是否使用，倾向于先规划——提前达成一致比返工要好
- 用户希望在对其代码库进行重大更改之前被征询意见
`
}

function getEnterPlanModeToolPromptAnt(): string {
  // When interview phase is enabled, omit the "What Happens" section —
  // detailed workflow instructions arrive via the plan_mode attachment (messages.ts).
  const whatHappens = isPlanModeInterviewPhaseEnabled()
    ? ''
    : WHAT_HAPPENS_SECTION

  return `当任务在正确方案上存在真正的歧义，且在编写代码前获取用户意见能避免大量返工时，请使用此工具。此工具将你切换到计划模式，让你可以探索代码库并设计实现方案以供用户审批。

## 何时使用此工具

当实现方案真正不明确时，计划模式很有价值。在以下情况下使用：

1. **重大架构歧义**：存在多种合理方案，且选择会对代码库产生实质性影响
   - 示例："为 API 添加缓存"——Redis vs 内存缓存 vs 文件缓存
   - 示例："添加实时更新"——WebSockets vs SSE vs 轮询

2. **需求不明确**：在取得进展之前需要先探索和澄清
   - 示例："让应用更快"——需要先分析并找出瓶颈
   - 示例："重构此模块"——需要了解目标架构应是什么

3. **高影响力重组**：任务将对现有代码进行重大重组，事先获得认同可降低风险
   - 示例："重新设计认证系统"
   - 示例："从一种状态管理方式迁移到另一种"

## 何时不应使用此工具

当可以合理推断出正确方案时，跳过计划模式：
- 任务直接明了，即便涉及多个文件
- 用户的请求足够具体，实现路径清晰
- 添加有明显实现模式的功能（例如，按照现有规范添加按钮、新端点）
- bug 修复，一旦理解了 bug，修复方式就很明确
- 研究/探索任务（改用 Agent 工具）
- 用户说"我们能做一下 X"或"我们来做 X"——直接开始工作

如有疑问，优先开始工作，并使用 ${ASK_USER_QUESTION_TOOL_NAME} 就具体问题提问，而不是进入完整的计划阶段。

${whatHappens}## 示例

### 正确——使用 EnterPlanMode：
用户："为应用添加用户认证"
- 真正的歧义：session vs JWT、token 存储位置、中间件结构

用户："重新设计数据管道"
- 重大重组，走错方向会浪费大量精力

### 错误——不要使用 EnterPlanMode：
用户："在用户资料中添加删除按钮"
- 实现路径清晰，直接做

用户："我们能做一下搜索功能吗？"
- 用户想直接开始，不想计划

用户："更新 API 中的错误处理"
- 开始工作，遇到具体问题再提问

用户："修复 README 中的拼写错误"
- 直接明了，无需计划

## 重要说明

- 此工具需要用户审批——他们必须同意进入计划模式
`
}

export function getEnterPlanModeToolPrompt(): string {
  return process.env.USER_TYPE === 'ant'
    ? getEnterPlanModeToolPromptAnt()
    : getEnterPlanModeToolPromptExternal()
}
