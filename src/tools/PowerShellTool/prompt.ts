import { isEnvTruthy } from '../../utils/envUtils.js'
import { getMaxOutputLength } from '../../utils/shell/outputLimits.js'
import {
  getPowerShellEdition,
  type PowerShellEdition,
} from '../../utils/shell/powershellDetection.js'
import {
  getDefaultBashTimeoutMs,
  getMaxBashTimeoutMs,
} from '../../utils/timeouts.js'
import { FILE_EDIT_TOOL_NAME } from '../FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../GlobTool/prompt.js'
import { GREP_TOOL_NAME } from '../GrepTool/prompt.js'
import { POWERSHELL_TOOL_NAME } from './toolName.js'

export function getDefaultTimeoutMs(): number {
  return getDefaultBashTimeoutMs()
}

export function getMaxTimeoutMs(): number {
  return getMaxBashTimeoutMs()
}

function getBackgroundUsageNote(): string | null {
  if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS)) {
    return null
  }
  return `  - 你可以使用 \`run_in_background\` 参数在后台运行命令。仅当你不需要立即获取结果且愿意在命令完成后再收到通知时才使用此选项。你不需要立即检查输出——命令完成时你会收到通知。`
}

function getSleepGuidance(): string | null {
  if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS)) {
    return null
  }
  return `  - 避免不必要的 \`Start-Sleep\` 命令：
    - 不要在可以立即运行的命令之间加入等待——直接运行即可。
    - 如果你的命令耗时较长，希望在完成时得到通知——只需使用 \`run_in_background\` 运行命令即可。这种情况下无需休眠。
    - 不要在循环中用休眠重试失败的命令——先诊断根本原因，或考虑替代方案。
    - 如果在等待用 \`run_in_background\` 启动的后台任务，完成时你会收到通知——不要轮询。
    - 如果必须轮询外部进程，请使用检查命令而不是先休眠。
    - 如果必须休眠，请保持时间较短（1-5 秒），以避免阻塞用户。`
}

/**
 * Version-specific syntax guidance. The model's training data covers both
 * editions but it can't tell which one it's targeting, so it either emits
 * pwsh-7 syntax on 5.1 (parser error → exit 1) or needlessly avoids && on 7.
 */
function getEditionSection(edition: PowerShellEdition | null): string {
  if (edition === 'desktop') {
    return `PowerShell 版本：Windows PowerShell 5.1 (powershell.exe)
   - 管道链操作符 \`&&\` 和 \`||\` 不可用——它们会导致解析错误。要在 A 成功时才运行 B：\`A; if ($?) { B }\`。无条件链式运行：\`A; B\`。
   - 三元运算符（\`?:\`）、空合并（\`??\`）和空条件（\`?.\`）运算符不可用。请改用 \`if/else\` 和显式的 \`$null -eq\` 检查。
   - 避免在原生可执行文件上使用 \`2>&1\`。在 5.1 中，在 PowerShell 内部重定向原生命令的 stderr 会将每行包装为 ErrorRecord（NativeCommandError），并将 \`$?\` 设为 \`$false\`，即使 exe 返回了退出码 0。stderr 已为你捕获——不要重定向它。
   - 默认文件编码为 UTF-16 LE（带 BOM）。写入其他工具将读取的文件时，向 \`Out-File\`/\`Set-Content\` 传入 \`-Encoding utf8\`。
   - \`ConvertFrom-Json\` 返回 PSCustomObject，而非哈希表。\`-AsHashtable\` 不可用。`
  }
  if (edition === 'core') {
    return `PowerShell 版本：PowerShell 7+（pwsh）
   - 管道链操作符 \`&&\` 和 \`||\` 可用，与 bash 类似。当 cmd2 仅在 cmd1 成功时才运行时，优先使用 \`cmd1 && cmd2\` 而非 \`cmd1; cmd2\`。
   - 三元运算符（\`$cond ? $a : $b\`）、空合并（\`??\`）和空条件（\`?.\`）运算符可用。
   - 默认文件编码为无 BOM 的 UTF-8。`
  }
  // Detection not yet resolved (first prompt build before any tool call) or
  // PS not installed. Give the conservative 5.1-safe guidance.
  return `PowerShell 版本：未知——出于兼容性考虑，假设为 Windows PowerShell 5.1
   - 不要使用 \`&&\`、\`||\`、三元运算符 \`?:\`、空合并 \`??\` 或空条件 \`?.\`。这些仅适用于 PowerShell 7+，在 5.1 上会导致解析错误。
   - 条件链式命令：\`A; if ($?) { B }\`。无条件链式运行：\`A; B\`。`
}

export async function getPrompt(): Promise<string> {
  const backgroundNote = getBackgroundUsageNote()
  const sleepGuidance = getSleepGuidance()
  const edition = await getPowerShellEdition()

  return `执行指定的 PowerShell 命令，支持可选超时。工作目录在命令之间持久保留；shell 状态（变量、函数）不保留。

重要提示：此工具用于通过 PowerShell 进行终端操作：git、npm、docker 和 PS cmdlet。不要用它进行文件操作（读取、写入、编辑、搜索、查找文件）——请为此使用专用工具。

${getEditionSection(edition)}

执行命令前，请遵循以下步骤：

1. 目录验证：
   - 如果命令将创建新目录或文件，请先使用 \`Get-ChildItem\`（或 \`ls\`）验证父目录存在且位置正确

2. 命令执行：
   - 始终用双引号引用包含空格的文件路径
   - 捕获命令的输出。

PowerShell 语法说明：
   - 变量使用 $ 前缀：$myVar = "value"
   - 转义字符是反引号（\`），而非反斜杠
   - 使用 Verb-Noun cmdlet 命名：Get-ChildItem、Set-Location、New-Item、Remove-Item
   - 常用别名：ls（Get-ChildItem）、cd（Set-Location）、cat（Get-Content）、rm（Remove-Item）
   - 管道操作符 | 与 bash 类似，但传递对象而非文本
   - 使用 Select-Object、Where-Object、ForEach-Object 进行过滤和转换
   - 字符串插值："Hello $name" 或 "Hello $($obj.Property)"
   - 注册表访问使用 PSDrive 前缀：\`HKLM:\\SOFTWARE\\...\`、\`HKCU:\\...\`——不要使用原始的 \`HKEY_LOCAL_MACHINE\\...\`
   - 环境变量：使用 \`$env:NAME\` 读取，使用 \`$env:NAME = "value"\` 设置（不要使用 \`Set-Variable\` 或 bash 的 \`export\`）
   - 调用路径中有空格的原生 exe，使用调用操作符：\`& "C:\\Program Files\\App\\app.exe" arg1 arg2\`

交互式和阻塞命令（会挂起——此工具以 -NonInteractive 运行）：
   - 绝不使用 \`Read-Host\`、\`Get-Credential\`、\`Out-GridView\`、\`$Host.UI.PromptForChoice\` 或 \`pause\`
   - 破坏性 cmdlet（\`Remove-Item\`、\`Stop-Process\`、\`Clear-Content\` 等）可能会提示确认。当你希望操作继续时，添加 \`-Confirm:$false\`。对只读/隐藏项目使用 \`-Force\`。
   - 绝不使用 \`git rebase -i\`、\`git add -i\` 或其他会打开交互式编辑器的命令

向原生可执行文件传递多行字符串（提交消息、文件内容）：
   - 使用单引号 here-string，这样 PowerShell 不会展开内部的 \`$\` 或反引号。结束标记 \`'@\` 必须在第 0 列（无前导空格），单独成行——缩进会导致解析错误：
<example>
git commit -m @'
Commit message here.
Second line with $literal dollar signs.
'@
</example>
   - 使用 \`@'...'@\`（单引号，字面量）而非 \`@"..."@\`（双引号，插值），除非你需要变量展开
   - 对于包含 \`-\`、\`@\` 或其他 PowerShell 解析为操作符的字符的参数，使用停止解析标记：\`git log --% --format=%H\`

使用说明：
  - command 参数为必填。
  - 你可以指定可选超时（毫秒）（最长 ${getMaxTimeoutMs()}ms / ${getMaxTimeoutMs() / 60000} 分钟）。如果未指定，命令将在 ${getDefaultTimeoutMs()}ms（${getDefaultTimeoutMs() / 60000} 分钟）后超时。
  - 对命令执行的内容提供清晰简洁的描述非常有帮助。
  - 如果输出超过 ${getMaxOutputLength()} 个字符，输出将在返回给你之前被截断。
${backgroundNote ? backgroundNote + '\n' : ''}\
  - 避免使用 PowerShell 运行有专用工具的命令，除非明确被要求：
    - 文件搜索：使用 ${GLOB_TOOL_NAME}（不要用 Get-ChildItem -Recurse）
    - 内容搜索：使用 ${GREP_TOOL_NAME}（不要用 Select-String）
    - 读取文件：使用 ${FILE_READ_TOOL_NAME}（不要用 Get-Content）
    - 编辑文件：使用 ${FILE_EDIT_TOOL_NAME}
    - 写入文件：使用 ${FILE_WRITE_TOOL_NAME}（不要用 Set-Content/Out-File）
    - 通信：直接输出文字（不要用 Write-Output/Write-Host）
  - 发出多条命令时：
    - 如果命令相互独立可以并行运行，在单条消息中进行多次 ${POWERSHELL_TOOL_NAME} 工具调用。
    - 如果命令相互依赖必须顺序运行，在单次 ${POWERSHELL_TOOL_NAME} 调用中链式执行（参见上方版本特定的链式语法）。
    - 仅当需要顺序运行但不关心前面命令是否失败时才使用 \`;\`。
    - 不要用换行符分隔命令（换行在引号字符串和 here-string 中是可以的）
  - 不要在命令前加 \`cd\` 或 \`Set-Location\`——工作目录已自动设置为正确的项目目录。
${sleepGuidance ? sleepGuidance + '\n' : ''}\
  - 对于 git 命令：
    - 优先创建新提交而不是修改已有提交。
    - 在运行破坏性操作之前（例如 git reset --hard、git push --force、git checkout --），考虑是否有更安全的替代方案能达到相同目标。只在这些操作确实是最佳方法时才使用。
    - 除非用户明确要求，否则绝不跳过钩子（--no-verify）或绕过签名（--no-gpg-sign、-c commit.gpgsign=false）。如果钩子失败，请调查并修复根本问题。`
}
