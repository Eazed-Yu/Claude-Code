// External stub for ExitPlanModeTool prompt - excludes Ant-only allowedPrompts section

// Hardcoded to avoid relative import issues in stub
const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion'

export const EXIT_PLAN_MODE_V2_TOOL_PROMPT = `当你处于计划模式、已完成将计划写入计划文件，并准备好获取用户审批时，请使用此工具。

## 此工具的工作方式
- 你应该已经将计划写入计划模式系统消息中指定的计划文件
- 此工具不接受计划内容作为参数——它会从你写入的文件中读取计划
- 此工具仅表示你已完成规划并准备好让用户审阅和审批
- 用户审阅时将看到你计划文件的内容

## 何时使用此工具
重要提示：仅在任务需要规划需要编写代码的任务实现步骤时才使用此工具。对于研究任务——收集信息、搜索文件、读取文件，或总体上试图了解代码库——请勿使用此工具。

## 使用此工具之前
确保你的计划完整且无歧义：
- 如果你对需求或方案有未解决的疑问，请先使用 ${ASK_USER_QUESTION_TOOL_NAME}（在早期阶段）
- 计划确定后，使用本工具请求审批

**重要提示：** 不要使用 ${ASK_USER_QUESTION_TOOL_NAME} 来询问"这个计划可以吗？"或"是否可以继续？"——这正是本工具的作用。ExitPlanMode 本身就在请求用户审批你的计划。

## 示例

1. 初始任务："搜索并了解代码库中 vim 模式的实现"——不要使用退出计划模式工具，因为你不是在规划任务的实现步骤。
2. 初始任务："帮我实现 vim 的 yank 模式"——在完成任务实现步骤的规划后，使用退出计划模式工具。
3. 初始任务："添加处理用户认证的新功能"——如果对认证方法（OAuth、JWT 等）不确定，先使用 ${ASK_USER_QUESTION_TOOL_NAME}，澄清方案后再使用退出计划模式工具。
`
