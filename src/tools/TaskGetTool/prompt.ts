export const DESCRIPTION = '通过 ID 从任务列表中获取任务'

export const PROMPT = `使用此工具通过 ID 从任务列表中检索任务。

## 何时使用此工具

- 当你在开始处理任务前需要完整的描述和上下文时
- 了解任务依赖关系（它阻塞什么，什么阻塞它）
- 被分配任务后，获取完整的需求

## 输出

返回完整的任务详情：
- **subject**：任务标题
- **description**：详细的需求和上下文
- **status**：'pending'、'in_progress' 或 'completed'
- **blocks**：等待此任务完成的任务
- **blockedBy**：必须在此任务开始前完成的任务

## 提示

- 获取任务后，在开始工作前验证其 blockedBy 列表是否为空。
- 使用 TaskList 以摘要形式查看所有任务。
`
