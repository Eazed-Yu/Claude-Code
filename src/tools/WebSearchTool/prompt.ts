import { getLocalMonthYear } from 'src/constants/common.js'

export const WEB_SEARCH_TOOL_NAME = 'WebSearch'

export function getWebSearchPrompt(): string {
  const currentMonthYear = getLocalMonthYear()
  return `
- 允许 Claude 搜索网络，并使用结果来丰富回应
- 提供当前事件和最新数据的实时信息
- 以搜索结果块的形式返回搜索结果信息，包含 Markdown 超链接格式的链接
- 需要访问 Claude 知识截止日期之后的信息时使用此工具
- 搜索在单次 API 调用内自动完成

关键要求——你必须遵守以下规定：
  - 回答用户问题后，你必须在回应末尾附上"参考来源："部分
  - 在参考来源部分，以 Markdown 超链接形式列出所有相关 URL：[标题](URL)
  - 这是强制要求——绝不跳过在回应中附上来源
  - 示例格式：

    [你的回答]

    参考来源：
    - [来源标题 1](https://example.com/1)
    - [来源标题 2](https://example.com/2)

使用说明：
  - 支持域名过滤，可包含或屏蔽特定网站
  - 网络搜索仅在美国可用

重要——搜索查询中使用正确年份：
  - 当前月份为 ${currentMonthYear}。搜索近期信息、文档或当前事件时，你必须使用当前年份，而非去年。
  - 示例：如果用户询问"最新的 React 文档"，请以当前年份搜索"React 文档"，而非去年
`
}
