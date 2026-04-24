import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'

export const FILE_WRITE_TOOL_NAME = 'Write'
export const DESCRIPTION = '将文件写入本地文件系统。'

function getPreReadInstruction(): string {
  return `\n- 如果是已存在的文件，你必须先使用 ${FILE_READ_TOOL_NAME} 工具读取文件内容。如果未先读取文件，此工具将失败。`
}

export function getWriteToolDescription(): string {
  return `将文件写入本地文件系统。

用法：
- 如果提供的路径已存在文件，此工具将覆盖该文件。${getPreReadInstruction()}
- 修改现有文件时优先使用 Edit 工具——它只发送差异部分。仅在创建新文件或完全重写时使用此工具。
- 除非用户明确要求，否则绝不创建文档文件（*.md）或 README 文件。
- 除非用户明确要求，否则不要使用表情符号。避免向文件写入表情符号，除非被要求。`
}
