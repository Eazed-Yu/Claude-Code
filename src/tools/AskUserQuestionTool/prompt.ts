import { EXIT_PLAN_MODE_TOOL_NAME } from '../ExitPlanModeTool/constants.js'

export const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion'

export const ASK_USER_QUESTION_TOOL_CHIP_WIDTH = 12

export const DESCRIPTION =
  '向用户提出多项选择问题，以收集信息、澄清歧义、了解偏好、做出决策或为其提供选项。'

export const PREVIEW_FEATURE_PROMPT = {
  markdown: `
预览功能：
当需要向用户展示具体制品供其直观比较时，请在选项上使用可选的 \`preview\` 字段：
- UI 布局或组件的 ASCII 草图
- 展示不同实现方式的代码片段
- 图表变体
- 配置示例

预览内容以 markdown 格式渲染在等宽字体方框中，支持包含换行符的多行文本。当任意选项设有预览时，UI 将切换为左侧纵向选项列表与右侧预览的并排布局。不要对仅需标签和描述即可区分的简单偏好问题使用预览。注意：预览仅支持单选问题（不支持 multiSelect）。
`,
  html: `
预览功能：
当需要向用户展示具体制品供其直观比较时，请在选项上使用可选的 \`preview\` 字段：
- UI 布局或组件的 HTML 草图
- 展示不同实现方式的格式化代码片段
- 视觉比较或图表

预览内容必须是自包含的 HTML 片段（不含 <html>/<body> 包裹，不含 <script> 或 <style> 标签——改用内联 style 属性）。不要对仅需标签和描述即可区分的简单偏好问题使用预览。注意：预览仅支持单选问题（不支持 multiSelect）。
`,
} as const

export const ASK_USER_QUESTION_TOOL_PROMPT = `在执行过程中需要向用户提问时，请使用此工具。它允许你：
1. 收集用户偏好或需求
2. 澄清模糊的指令
3. 在工作过程中就实现选择获取决策意见
4. 为用户提供方向选择。

使用说明：
- 用户始终可以选择"其他"以提供自定义文本输入
- 使用 multiSelect: true 允许用户为某个问题选择多个答案
- 如果你推荐某个特定选项，请将其设为列表中的第一个选项，并在标签末尾加上"（推荐）"

计划模式说明：在计划模式下，请在最终确定计划之前使用此工具澄清需求或在不同方案之间做出选择。请勿使用此工具询问"我的计划准备好了吗？"或"是否可以继续？"——请使用 ${EXIT_PLAN_MODE_TOOL_NAME} 来审批计划。重要提示：请勿在问题中提及"计划"（例如"您对计划有什么反馈？"、"计划看起来如何？"），因为在你调用 ${EXIT_PLAN_MODE_TOOL_NAME} 之前，用户在 UI 中看不到该计划。如需获得计划审批，请改用 ${EXIT_PLAN_MODE_TOOL_NAME}。
`
