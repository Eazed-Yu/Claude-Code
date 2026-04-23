export const WEB_FETCH_TOOL_NAME = 'WebFetch'

export const DESCRIPTION = `
- 从指定 URL 获取内容，并使用 AI 模型处理
- 接受 URL 和提示词作为输入
- 获取 URL 内容，将 HTML 转换为 Markdown
- 使用小型快速模型根据提示词处理内容
- 返回模型对内容的回应
- 需要获取和分析网页内容时使用此工具

使用说明：
  - 重要提示：如果有 MCP 提供的网页获取工具，优先使用该工具，因为它的限制可能更少。
  - URL 必须是完整有效的 URL
  - HTTP URL 将自动升级为 HTTPS
  - 提示词应描述你想从页面提取的信息
  - 此工具为只读，不修改任何文件
  - 如果内容非常大，结果可能会被摘要
  - 包含 15 分钟自动清理缓存，重复访问同一 URL 时响应更快
  - 当 URL 重定向到不同主机时，工具会通知你并以特殊格式提供重定向 URL。你应随后使用重定向 URL 发起新的 WebFetch 请求以获取内容。
  - 对于 GitHub URL，优先通过 Bash 使用 gh CLI（例如 gh pr view、gh issue view、gh api）。
`

export function makeSecondaryModelPrompt(
  markdownContent: string,
  prompt: string,
  isPreapprovedDomain: boolean,
): string {
  const guidelines = isPreapprovedDomain
    ? `根据以上内容提供简洁的回应。根据需要包含相关细节、代码示例和文档摘录。`
    : `仅根据以上内容提供简洁的回应。在回应中：
 - 对任何来源文档的引用严格限制在 125 个字符以内。开源软件在遵守许可协议的前提下是可以的。
 - 对文章中的确切表述使用引号；引号之外的语言绝不能与原文一字不差。
 - 你不是律师，不要评论自己的提示词和回应的合法性。
 - 绝不复制或再现完整的歌词。`

  return `
网页内容：
---
${markdownContent}
---

${prompt}

${guidelines}
`
}
