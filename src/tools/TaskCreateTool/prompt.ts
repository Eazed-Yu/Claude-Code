import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'

export const DESCRIPTION = '在任务列表中创建新任务'

export function getPrompt(): string {
  const teammateContext = isAgentSwarmsEnabled()
    ? '，并可能分配给队友'
    : ''

  const teammateTips = isAgentSwarmsEnabled()
    ? `- 在描述中提供足够的细节，让其他代理能够理解并完成任务
- 新任务创建时状态为 'pending' 且无所有者——使用带 \`owner\` 参数的 TaskUpdate 来分配任务
`
    : ''

  return `使用此工具为当前编程会话创建结构化的任务列表。这有助于跟踪进度、组织复杂任务，并向用户展示你的工作全面性。
也有助于用户了解任务进展和其请求的整体完成情况。

## 何时使用此工具

在以下情况下主动使用此工具：

- 复杂的多步骤任务——当任务需要 3 个或更多不同的步骤或操作时
- 非简单的复杂任务——需要仔细规划或多个操作的任务${teammateContext}
- 计划模式——使用计划模式时，创建任务列表来跟踪工作
- 用户明确要求待办事项列表——当用户直接要求你使用待办事项列表时
- 用户提供多个任务——当用户提供一系列待完成事项（编号或逗号分隔）时
- 收到新指令后——立即将用户需求记录为任务
- 开始处理任务时——在开始工作前将其标记为 in_progress
- 完成任务后——标记为已完成，并添加实现过程中发现的后续任务

## 何时不应使用此工具

在以下情况下跳过此工具：
- 只有一个直接明了的任务
- 任务很简单，跟踪它没有组织价值
- 任务可以在不到 3 个简单步骤内完成
- 任务纯粹是对话性或信息性的

注意：如果只有一个简单任务，不应使用此工具。这种情况下直接完成任务更好。

## 任务字段

- **subject**：简短的、祈使式的可操作标题（例如"修复登录流程中的认证 bug"）
- **description**：需要完成的内容
- **activeForm**（可选）：任务处于 in_progress 时在进度条中显示的进行时形式（例如"正在修复认证 bug"）。如果省略，进度条将显示 subject。

所有任务创建时状态为 \`pending\`。

## 提示

- 创建带有明确、具体主题的任务，描述预期结果
- 创建任务后，如需要可使用 TaskUpdate 设置依赖关系（blocks/blockedBy）
${teammateTips}- 先检查 TaskList，避免创建重复任务
`
}
