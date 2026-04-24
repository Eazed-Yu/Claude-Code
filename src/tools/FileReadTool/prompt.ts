import { isPDFSupported } from '../../utils/pdfUtils.js'
import { BASH_TOOL_NAME } from '../BashTool/toolName.js'

// Use a string constant for tool names to avoid circular dependencies
export const FILE_READ_TOOL_NAME = 'Read'

export const FILE_UNCHANGED_STUB =
  '自上次读取以来文件未发生变化。本次对话中较早的 Read 工具结果仍然有效——请直接参考，无需重新读取。'

export const MAX_LINES_TO_READ = 2000

export const DESCRIPTION = '从本地文件系统读取文件。'

export const LINE_FORMAT_INSTRUCTION =
  '- 结果以 cat -n 格式返回，行号从 1 开始'

export const OFFSET_INSTRUCTION_DEFAULT =
  "- 你可以选择指定行偏移量和限制（对于长文件特别有用），但建议通过不提供这些参数来读取整个文件"

export const OFFSET_INSTRUCTION_TARGETED =
  '- 当你已经知道需要文件的哪个部分时，只读取该部分。这对于较大的文件很重要。'

/**
 * Renders the Read tool prompt template.  The caller (FileReadTool) supplies
 * the runtime-computed parts.
 */
export function renderPromptTemplate(
  lineFormat: string,
  maxSizeInstruction: string,
  offsetInstruction: string,
): string {
  return `从本地文件系统读取文件。你可以使用此工具直接访问任何文件。
假设此工具能够读取机器上的所有文件。如果用户提供了文件路径，假设该路径有效。读取不存在的文件是可以的；此时会返回错误。

用法：
- file_path 参数必须是绝对路径，而非相对路径
- 默认情况下，从文件开头读取最多 ${MAX_LINES_TO_READ} 行${maxSizeInstruction}
${offsetInstruction}
${lineFormat}
- 此工具允许 Claude Code 读取图片（如 PNG、JPG 等）。读取图片文件时，内容以视觉方式呈现，因为 Claude Code 是多模态大语言模型。${
    isPDFSupported()
      ? '\n- 此工具可以读取 PDF 文件（.pdf）。对于较大的 PDF（超过 10 页），你必须提供 pages 参数来读取特定页码范围（例如 pages: "1-5"）。不提供 pages 参数读取大型 PDF 会失败。每次请求最多 20 页。'
      : ''
  }
- 此工具可以读取 Jupyter notebook（.ipynb 文件），并返回所有单元格及其输出，包含代码、文本和可视化内容。
- 此工具只能读取文件，不能读取目录。要读取目录内容，请通过 ${BASH_TOOL_NAME} 工具使用 ls 命令。
- 用户经常会要求你查看截图。如果用户提供了截图的路径，请始终使用此工具查看该路径的文件。此工具适用于所有临时文件路径。
- 如果你读取的文件存在但内容为空，你将收到系统提醒警告，而不是文件内容。`
}
