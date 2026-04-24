import { isCompactLinePrefixEnabled } from '../../utils/file.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'

function getPreReadInstruction(): string {
  return `\n- 在编辑之前，你必须在对话中至少使用一次 \`${FILE_READ_TOOL_NAME}\` 工具。如果在未读取文件的情况下尝试编辑，此工具将报错。 `
}

export function getEditToolDescription(): string {
  return getDefaultEditDescription()
}

function getDefaultEditDescription(): string {
  const prefixFormat = isCompactLinePrefixEnabled()
    ? 'line number + tab'
    : 'spaces + line number + arrow'
  const minimalUniquenessHint =
    process.env.USER_TYPE === 'ant'
      ? `\n- 使用能明确唯一标识目标的最小 old_string——通常 2-4 行相邻内容即可。避免在 10 行以上的上下文中，实际上更少内容就能唯一确定目标时仍大量引用。`
      : ''
  return `对文件执行精确的字符串替换。

用法：${getPreReadInstruction()}
- 编辑 Read 工具输出的文本时，请确保保留行号前缀之后的确切缩进（制表符/空格）。行号前缀格式为：${prefixFormat}。该前缀之后的所有内容才是实际的文件内容。old_string 或 new_string 中永远不要包含行号前缀的任何部分。
- 始终优先编辑代码库中的现有文件。除非明确需要，否则绝不创建新文件。
- 除非用户明确要求，否则不要使用表情符号。避免向文件添加表情符号，除非被要求。
- 如果 \`old_string\` 在文件中不唯一，编辑将失败。请提供包含更多周围上下文的更大字符串以确保唯一性，或使用 \`replace_all\` 替换所有 \`old_string\` 出现的位置。${minimalUniquenessHint}
- 使用 \`replace_all\` 在整个文件中替换和重命名字符串。例如，当你想重命名一个变量时，此参数非常有用。`
}
