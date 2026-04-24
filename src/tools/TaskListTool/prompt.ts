import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'

export const DESCRIPTION = '列出任务列表中的所有任务'

export function getPrompt(): string {
  const teammateUseCase = isAgentSwarmsEnabled()
    ? `- 向队友分配任务之前，查看哪些任务可用
`
    : ''

  const idDescription = isAgentSwarmsEnabled()
    ? '- **id**：任务标识符（与 TaskGet、TaskUpdate 配合使用）'
    : '- **id**：任务标识符（与 TaskGet、TaskUpdate 配合使用）'

  const teammateWorkflow = isAgentSwarmsEnabled()
    ? `
## 队友工作流

作为队友工作时：
1. 完成当前任务后，调用 TaskList 查找可用工作
2. 查找状态为 'pending'、无所有者且 blockedBy 为空的任务
3. **有多个可用任务时优先选择 ID 最小的任务**，因为较早的任务通常会为后续任务建立上下文
4. 使用 TaskUpdate 认领可用任务（将 \`owner\` 设为你的名字），或等待负责人分配
5. 如果被阻塞，专注于解除阻塞的任务或通知团队负责人
`
    : ''

  return `使用此工具列出任务列表中的所有任务。

## 何时使用此工具

- 查看哪些任务可以处理（状态为 'pending'，无所有者，未被阻塞）
- 检查项目的整体进度
- 查找被阻塞且需要解决依赖的任务
${teammateUseCase}- 完成任务后，检查是否有新解除阻塞的工作，或认领下一个可用任务
- **有多个可用任务时优先按 ID 顺序处理**（从最小 ID 开始），因为较早的任务通常会为后续任务建立上下文

## 输出

返回每个任务的摘要：
${idDescription}
- **subject**：任务的简短描述
- **status**：'pending'、'in_progress' 或 'completed'
- **owner**：已分配时为代理 ID，可用时为空
- **blockedBy**：必须先解决的未完成任务 ID 列表（有 blockedBy 的任务在依赖解决之前无法被认领）

使用 TaskGet 加上特定任务 ID 可查看包括描述和备注在内的完整详情。
${teammateWorkflow}`
}
