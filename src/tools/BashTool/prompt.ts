import { feature } from 'bun:bundle'
import { prependBullets } from '../../constants/prompts.js'
import { getAttributionTexts } from '../../utils/attribution.js'
import { hasEmbeddedSearchTools } from '../../utils/embeddedTools.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { shouldIncludeGitInstructions } from '../../utils/gitSettings.js'
import { getClaudeTempDir } from '../../utils/permissions/filesystem.js'
import { SandboxManager } from '../../utils/sandbox/sandbox-adapter.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  getDefaultBashTimeoutMs,
  getMaxBashTimeoutMs,
} from '../../utils/timeouts.js'
import {
  getUndercoverInstructions,
  isUndercover,
} from '../../utils/undercover.js'
import { AGENT_TOOL_NAME } from '../AgentTool/constants.js'
import { FILE_EDIT_TOOL_NAME } from '../FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../GlobTool/prompt.js'
import { GREP_TOOL_NAME } from '../GrepTool/prompt.js'
import { TodoWriteTool } from '../TodoWriteTool/TodoWriteTool.js'
import { BASH_TOOL_NAME } from './toolName.js'

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
  return "你可以使用 `run_in_background` 参数在后台运行命令。仅当你不需要立即获取结果且可以接受稍后收到命令完成通知时才使用此选项。你无需立即检查输出——命令完成时你会收到通知。使用此参数时，命令末尾无需加 '&'。"
}

function getCommitAndPRInstructions(): string {
  // Defense-in-depth: undercover instructions must survive even if the user
  // has disabled git instructions entirely. Attribution stripping and model-ID
  // hiding are mechanical and work regardless, but the explicit "don't blow
  // your cover" instructions are the last line of defense against the model
  // volunteering an internal codename in a commit message.
  const undercoverSection =
    process.env.USER_TYPE === 'ant' && isUndercover()
      ? getUndercoverInstructions() + '\n'
      : ''

  if (!shouldIncludeGitInstructions()) return undercoverSection

  // For ant users, use the short version pointing to skills
  if (process.env.USER_TYPE === 'ant') {
    const skillsSection = !isEnvTruthy(process.env.CLAUDE_CODE_SIMPLE)
      ? `进行 git 提交和拉取请求时，请使用 \`/commit\` 和 \`/commit-push-pr\` 技能：
- \`/commit\` - 使用暂存的更改创建 git 提交
- \`/commit-push-pr\` - 提交、推送并创建拉取请求

这些技能处理 git 安全协议、正确的提交消息格式化和 PR 创建。

创建拉取请求之前，运行 \`/simplify\` 审查你的更改，然后进行端到端测试（例如，通过 \`/tmux\` 测试交互式功能）。

`
      : ''
    return `${undercoverSection}# Git 操作

${skillsSection}重要提示：除非用户明确要求，否则绝不跳过钩子（--no-verify、--no-gpg-sign 等）。

使用 Bash 工具中的 gh 命令处理其他 GitHub 相关任务，包括处理 issue、检查和发布。如果给出了 GitHub URL，请使用 gh 命令获取所需信息。

# 其他常用操作
- 查看 Github PR 上的评论：gh api repos/foo/bar/pulls/123/comments`
  }

  // For external users, include full inline instructions
  const { commit: commitAttribution, pr: prAttribution } = getAttributionTexts()

  return `# 使用 git 提交更改

仅在用户请求时创建提交。如果不确定，请先询问。当用户要求你创建新的 git 提交时，请仔细遵循以下步骤：

你可以在单条响应中调用多个工具。当请求了多个独立信息且所有命令都可能成功时，并行运行多个工具调用以获得最佳性能。以下编号步骤指示哪些命令应该批量并行执行。

Git 安全协议：
- 绝不更新 git 配置
- 绝不运行破坏性的 git 命令（push --force、reset --hard、checkout .、restore .、clean -f、branch -D），除非用户明确要求这些操作。未经授权的破坏性操作是有害的，可能导致工作丢失，所以最好只在收到明确指令时才运行这些命令
- 绝不跳过钩子（--no-verify、--no-gpg-sign 等），除非用户明确要求
- 绝不向 main/master 强制推送，如果用户要求请警告
- 关键提示：始终创建新提交而不是修改，除非用户明确要求 git amend。当预提交钩子失败时，提交未发生——所以 --amend 会修改上一个提交，可能导致工作丢失或先前更改丢失。相反，钩子失败后，修复问题，重新暂存，并创建新提交
- 暂存文件时，优先按名称添加特定文件，而不是使用"git add -A"或"git add ."，后者可能意外包含敏感文件（.env、凭据）或大型二进制文件
- 除非用户明确要求，否则绝不提交更改。只在明确被要求时才提交非常重要，否则用户会觉得你过于主动

1. 使用 ${BASH_TOOL_NAME} 工具并行运行以下 bash 命令：
  - 运行 git status 命令查看所有未跟踪的文件。重要：绝不使用 -uall 标志，因为在大型仓库上可能导致内存问题。
  - 运行 git diff 命令查看将要提交的暂存和未暂存的更改。
  - 运行 git log 命令查看最近的提交消息，以便遵循此仓库的提交消息风格。
2. 分析所有暂存的更改（先前暂存的和新添加的），起草提交消息：
  - 总结更改的性质（例如，新功能、对现有功能的增强、bug 修复、重构、测试、文档等）。确保消息准确反映更改及其目的（即"add"表示全新功能，"update"表示对现有功能的增强，"fix"表示 bug 修复等）。
  - 不要提交可能包含机密的文件（.env、credentials.json 等）。如果用户特别要求提交这些文件，请警告
  - 起草一条简洁的（1-2 句）提交消息，侧重于"为什么"而非"是什么"
  - 确保它准确反映更改及其目的
3. 并行运行以下命令：
   - 将相关的未跟踪文件添加到暂存区。
   - 创建提交，消息${commitAttribution ? `以以下内容结尾：\n   ${commitAttribution}` : '。'}
   - 提交完成后运行 git status 验证是否成功。
   注意：git status 依赖提交完成，所以在提交后顺序运行。
4. 如果提交因预提交钩子失败：修复问题并创建新提交

重要说明：
- 绝不运行额外的命令来读取或探索代码，除了 git bash 命令
- 绝不使用 ${TodoWriteTool.name} 或 ${AGENT_TOOL_NAME} 工具
- 除非用户明确要求，否则不要推送到远程仓库
- 重要提示：绝不使用带 -i 标志的 git 命令（如 git rebase -i 或 git add -i），因为它们需要不支持的交互式输入。
- 重要提示：不要在 git rebase 命令中使用 --no-edit，因为 --no-edit 标志对 git rebase 无效。
- 如果没有要提交的更改（即没有未跟踪的文件且没有修改），不要创建空提交
- 为确保格式正确，始终通过 HEREDOC 传递提交消息，示例如下：
<example>
git commit -m "$(cat <<'EOF'
   提交消息内容。${commitAttribution ? `\n\n   ${commitAttribution}` : ''}
   EOF
   )"
</example>

# 创建拉取请求
使用 Bash 工具中的 gh 命令处理所有 GitHub 相关任务，包括处理 issue、拉取请求、检查和发布。如果给出了 GitHub URL，请使用 gh 命令获取所需信息。

重要提示：当用户要求你创建拉取请求时，请仔细遵循以下步骤：

1. 使用 ${BASH_TOOL_NAME} 工具并行运行以下 bash 命令，以了解分支自从从主分支分叉以来的当前状态：
   - 运行 git status 命令查看所有未跟踪的文件（绝不使用 -uall 标志）
   - 运行 git diff 命令查看将要提交的暂存和未暂存的更改
   - 检查当前分支是否跟踪远程分支并与远程保持同步，以便了解是否需要推送到远程
   - 运行 git log 命令和 \`git diff [base-branch]...HEAD\` 了解当前分支的完整提交历史（从它从基础分支分叉的时间起）
2. 分析将包含在拉取请求中的所有更改，确保查看所有相关提交（不仅仅是最新提交，而是将包含在 PR 中的所有提交！！！），并起草拉取请求标题和摘要：
   - 保持 PR 标题简短（70 个字符以内）
   - 详情放在描述/正文中，而非标题
3. 并行运行以下命令：
   - 如有需要创建新分支
   - 如有需要使用 -u 标志推送到远程
   - 使用如下格式通过 gh pr create 创建 PR。使用 HEREDOC 传递正文以确保格式正确。
<example>
gh pr create --title "pr 标题" --body "$(cat <<'EOF'
## 摘要
<1-3 个要点>

## 测试计划
[测试拉取请求的待办事项 Markdown 清单...]${prAttribution ? `\n\n${prAttribution}` : ''}
EOF
)"
</example>

重要事项：
- 不要使用 ${TodoWriteTool.name} 或 ${AGENT_TOOL_NAME} 工具
- 完成后返回 PR URL，以便用户查看

# 其他常用操作
- 查看 Github PR 上的评论：gh api repos/foo/bar/pulls/123/comments`
}

// SandboxManager merges config from multiple sources (settings layers, defaults,
// CLI flags) without deduping, so paths like ~/.cache appear 3× in allowOnly.
// Dedup here before inlining into the prompt — affects only what the model sees,
// not sandbox enforcement. Saves ~150-200 tokens/request when sandbox is enabled.
function dedup<T>(arr: T[] | undefined): T[] | undefined {
  if (!arr || arr.length === 0) return arr
  return [...new Set(arr)]
}

function getSimpleSandboxSection(): string {
  if (!SandboxManager.isSandboxingEnabled()) {
    return ''
  }

  const fsReadConfig = SandboxManager.getFsReadConfig()
  const fsWriteConfig = SandboxManager.getFsWriteConfig()
  const networkRestrictionConfig = SandboxManager.getNetworkRestrictionConfig()
  const allowUnixSockets = SandboxManager.getAllowUnixSockets()
  const ignoreViolations = SandboxManager.getIgnoreViolations()
  const allowUnsandboxedCommands =
    SandboxManager.areUnsandboxedCommandsAllowed()

  // Replace the per-UID temp dir literal (e.g. /private/tmp/claude-1001/) with
  // "$TMPDIR" so the prompt is identical across users — avoids busting the
  // cross-user global prompt cache. The sandbox already sets $TMPDIR at runtime.
  const claudeTempDir = getClaudeTempDir()
  const normalizeAllowOnly = (paths: string[]): string[] =>
    [...new Set(paths)].map(p => (p === claudeTempDir ? '$TMPDIR' : p))

  const filesystemConfig = {
    read: {
      denyOnly: dedup(fsReadConfig.denyOnly),
      ...(fsReadConfig.allowWithinDeny && {
        allowWithinDeny: dedup(fsReadConfig.allowWithinDeny),
      }),
    },
    write: {
      allowOnly: normalizeAllowOnly(fsWriteConfig.allowOnly),
      denyWithinAllow: dedup(fsWriteConfig.denyWithinAllow),
    },
  }

  const networkConfig = {
    ...(networkRestrictionConfig?.allowedHosts && {
      allowedHosts: dedup(networkRestrictionConfig.allowedHosts),
    }),
    ...(networkRestrictionConfig?.deniedHosts && {
      deniedHosts: dedup(networkRestrictionConfig.deniedHosts),
    }),
    ...(allowUnixSockets && { allowUnixSockets: dedup(allowUnixSockets) }),
  }

  const restrictionsLines = []
  if (Object.keys(filesystemConfig).length > 0) {
    restrictionsLines.push(`Filesystem: ${jsonStringify(filesystemConfig)}`)
  }
  if (Object.keys(networkConfig).length > 0) {
    restrictionsLines.push(`Network: ${jsonStringify(networkConfig)}`)
  }
  if (ignoreViolations) {
    restrictionsLines.push(
      `Ignored violations: ${jsonStringify(ignoreViolations)}`,
    )
  }

  const sandboxOverrideItems: Array<string | string[]> =
    allowUnsandboxedCommands
      ? [
          '你应该始终默认在沙盒内运行命令。不要尝试设置 `dangerouslyDisableSandbox: true`，除非：',
          [
            '用户*明确*要求绕过沙盒',
            '某个特定命令刚刚失败，并且你看到沙盒限制导致失败的证据。请注意，命令可能因与沙盒无关的许多原因失败（文件缺失、错误参数、网络问题等）。',
          ],
          '沙盒导致失败的证据包括：',
          [
            '文件/网络操作的"Operation not permitted"错误',
            '访问允许目录之外的特定路径被拒绝',
            '连接非白名单主机的网络连接失败',
            'Unix socket 连接错误',
          ],
          '当你看到沙盒导致失败的证据时：',
          [
            '立即用 `dangerouslyDisableSandbox: true` 重试（不要询问，直接执行）',
            '简要解释沙盒限制可能导致失败的原因。务必提醒用户可以使用 `/sandbox` 命令管理限制。',
            '这将提示用户授权',
          ],
          '对每个使用 `dangerouslyDisableSandbox: true` 执行的命令单独处理。即使你最近运行了带此设置的命令，未来的命令也应默认在沙盒内运行。',
          '不要建议将敏感路径如 ~/.bashrc、~/.zshrc、~/.ssh/* 或凭据文件添加到沙盒允许列表中。',
        ]
      : [
          '所有命令必须在沙盒模式下运行——`dangerouslyDisableSandbox` 参数已被策略禁用。',
          '命令在任何情况下都不能在沙盒外运行。',
          '如果命令因沙盒限制而失败，请与用户协商调整沙盒设置。',
        ]

  const items: Array<string | string[]> = [
    ...sandboxOverrideItems,
    '对于临时文件，始终使用 `$TMPDIR` 环境变量。在沙盒模式下，TMPDIR 会自动设置为正确的沙盒可写目录。不要直接使用 `/tmp`——请改用 `$TMPDIR`。',
  ]

  return [
    '',
    '## 命令沙盒',
    '默认情况下，你的命令将在沙盒中运行。此沙盒控制命令可以访问或修改哪些目录和网络主机，无需显式覆盖。',
    '',
    '沙盒有以下限制：',
    restrictionsLines.join('\n'),
    '',
    ...prependBullets(items),
  ].join('\n')
}

export function getSimplePrompt(): string {
  // Ant-native builds alias find/grep to embedded bfs/ugrep in Claude's shell,
  // so we don't steer away from them (and Glob/Grep tools are removed).
  const embedded = hasEmbeddedSearchTools()

  const toolPreferenceItems = [
    ...(embedded
      ? []
      : [
          `文件搜索：使用 ${GLOB_TOOL_NAME}（不要用 find 或 ls）`,
          `内容搜索：使用 ${GREP_TOOL_NAME}（不要用 grep 或 rg）`,
        ]),
    `读取文件：使用 ${FILE_READ_TOOL_NAME}（不要用 cat/head/tail）`,
    `编辑文件：使用 ${FILE_EDIT_TOOL_NAME}（不要用 sed/awk）`,
    `写入文件：使用 ${FILE_WRITE_TOOL_NAME}（不要用 echo >/cat <<EOF）`,
    '通信：直接输出文字（不要用 echo/printf）',
  ]

  const avoidCommands = embedded
    ? '`cat`、`head`、`tail`、`sed`、`awk` 或 `echo`'
    : '`find`、`grep`、`cat`、`head`、`tail`、`sed`、`awk` 或 `echo`'

  const multipleCommandsSubitems = [
    `如果命令相互独立可以并行运行，在单条消息中进行多次 ${BASH_TOOL_NAME} 工具调用。示例：如果需要运行"git status"和"git diff"，请发送一条包含两个并行 ${BASH_TOOL_NAME} 工具调用的消息。`,
    `如果命令相互依赖必须顺序运行，使用单次 ${BASH_TOOL_NAME} 调用并用 '&&' 链式连接。`,
    "仅当需要顺序运行但不关心前面命令是否失败时才使用 ';'。",
    '不要用换行符分隔命令（换行在引号字符串中是可以的）。',
  ]

  const gitSubitems = [
    '优先创建新提交而不是修改已有提交。',
    '在运行破坏性操作之前（例如 git reset --hard、git push --force、git checkout --），考虑是否有更安全的替代方案能达到相同目标。只在这些操作确实是最佳方法时才使用。',
    '除非用户明确要求，否则绝不跳过钩子（--no-verify）或绕过签名（--no-gpg-sign、-c commit.gpgsign=false）。如果钩子失败，请调查并修复根本问题。',
  ]

  const sleepSubitems = [
    '不要在可以立即运行的命令之间加入休眠——直接运行即可。',
    ...(feature('MONITOR_TOOL')
      ? [
          '使用 Monitor 工具从后台进程流式传输事件（每行 stdout 就是一条通知）。对于一次性的"等待完成"，改用带 run_in_background 的 Bash。',
        ]
      : []),
    '如果你的命令运行时间较长，希望完成时收到通知——使用 `run_in_background`。不需要休眠。',
    '不要在休眠循环中重试失败的命令——诊断根本原因。',
    '如果在等待用 `run_in_background` 启动的后台任务，完成时你会收到通知——不要轮询。',
    ...(feature('MONITOR_TOOL')
      ? [
          '首个命令为 N ≥ 2 的 `sleep N` 被阻止。如果需要延迟（限速、刻意节奏），请保持在 2 秒以内。',
        ]
      : [
          '如果必须轮询外部进程，使用检查命令（例如 `gh run view`）而不是先休眠。',
          '如果必须休眠，请保持时间较短（1-5 秒），以避免阻塞用户。',
        ]),
  ]
  const backgroundNote = getBackgroundUsageNote()

  const instructionItems: Array<string | string[]> = [
    '如果你的命令将创建新目录或文件，请先使用此工具运行 `ls` 验证父目录存在且位置正确。',
    '命令中包含空格的文件路径始终用双引号引起来（例如，cd "path with spaces/file.txt"）',
    '尽量在整个会话中使用绝对路径并避免使用 `cd` 来保持当前工作目录不变。如果用户明确要求，你可以使用 `cd`。',
    `You may specify an optional timeout in milliseconds (up to ${getMaxTimeoutMs()}ms / ${getMaxTimeoutMs() / 60000} minutes). By default, your command will timeout after ${getDefaultTimeoutMs()}ms (${getDefaultTimeoutMs() / 60000} minutes).`,
    ...(backgroundNote !== null ? [backgroundNote] : []),
    '发出多条命令时：',
    multipleCommandsSubitems,
    '对于 git 命令：',
    gitSubitems,
    '避免不必要的 `sleep` 命令：',
    sleepSubitems,
    ...(embedded
      ? [
          // bfs (which backs `find`) uses Oniguruma for -regex, which picks the
          // FIRST matching alternative (leftmost-first), unlike GNU find's
          // POSIX leftmost-longest. This silently drops matches when a shorter
          // alternative is a prefix of a longer one.
          "使用 `find -regex` 带交替模式时，将最长的替代项放在前面。示例：使用 `'.*\\.\\(tsx\\|ts\\)'` 而不是 `'.*\\.\\(ts\\|tsx\\)'`——第二种形式会静默跳过 `.tsx` 文件。",
        ]
      : []),
  ]

  return [
    '执行给定的 bash 命令并返回其输出。',
    '',
    "工作目录在命令之间持久保留，但 shell 状态不保留。Shell 环境从用户的配置文件（bash 或 zsh）初始化。",
    '',
    `重要提示：避免使用此工具运行 ${avoidCommands} 命令，除非明确被要求或已验证专用工具无法完成任务。请改用相应的专用工具，这将为用户提供更好的体验：`,
    '',
    ...prependBullets(toolPreferenceItems),
    `虽然 ${BASH_TOOL_NAME} 工具可以完成类似的事情，但最好使用内置工具，因为它们提供更好的用户体验，并使审查工具调用和授权更容易。`,mport { hasEmbeddedSearchTools } from '../../utils/embeddedTools.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { shouldIncludeGitInstructions } from '../../utils/gitSettings.js'
import { getClaudeTempDir } from '../../utils/permissions/filesystem.js'
import { SandboxManager } from '../../utils/sandbox/sandbox-adapter.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  getDefaultBashTimeoutMs,
  getMaxBashTimeoutMs,
} from '../../utils/timeouts.js'
import {
  getUndercoverInstructions,
  isUndercover,
} from '../../utils/undercover.js'
import { AGENT_TOOL_NAME } from '../AgentTool/constants.js'
import { FILE_EDIT_TOOL_NAME } from '../FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../GlobTool/prompt.js'
import { GREP_TOOL_NAME } from '../GrepTool/prompt.js'
import { TodoWriteTool } from '../TodoWriteTool/TodoWriteTool.js'
import { BASH_TOOL_NAME } from './toolName.js'

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
  return "你可以使用 `run_in_background` 参数在后台运行命令。仅当你不需要立即获取结果且可以接受稍后收到命令完成通知时才使用此选项。你无需立即检查输出——命令完成时你会收到通知。使用此参数时，命令末尾无需加 '&'。"
}

function getCommitAndPRInstructions(): string {
  // Defense-in-depth: undercover instructions must survive even if the user
  // has disabled git instructions entirely. Attribution stripping and model-ID
  // hiding are mechanical and work regardless, but the explicit "don't blow
  // your cover" instructions are the last line of defense against the model
  // volunteering an internal codename in a commit message.
  const undercoverSection =
    process.env.USER_TYPE === 'ant' && isUndercover()
      ? getUndercoverInstructions() + '\n'
      : ''

  if (!shouldIncludeGitInstructions()) return undercoverSection

  // For ant users, use the short version pointing to skills
  if (process.env.USER_TYPE === 'ant') {
    const skillsSection = !isEnvTruthy(process.env.CLAUDE_CODE_SIMPLE)
      ? `进行 git 提交和拉取请求时，请使用 \`/commit\` 和 \`/commit-push-pr\` 技能：
- \`/commit\` - 使用暂存的更改创建 git 提交
- \`/commit-push-pr\` - 提交、推送并创建拉取请求

这些技能处理 git 安全协议、正确的提交消息格式化和 PR 创建。

创建拉取请求之前，运行 \`/simplify\` 审查你的更改，然后进行端到端测试（例如，通过 \`/tmux\` 测试交互式功能）。

`
      : ''
    return `${undercoverSection}# Git 操作

${skillsSection}重要提示：除非用户明确要求，否则绝不跳过钩子（--no-verify、--no-gpg-sign 等）。

使用 Bash 工具中的 gh 命令处理其他 GitHub 相关任务，包括处理 issue、检查和发布。如果给出了 GitHub URL，请使用 gh 命令获取所需信息。

# 其他常用操作
- 查看 Github PR 上的评论：gh api repos/foo/bar/pulls/123/comments`
  }

  // For external users, include full inline instructions
  const { commit: commitAttribution, pr: prAttribution } = getAttributionTexts()

  return `# 使用 git 提交更改

仅在用户请求时创建提交。如果不确定，请先询问。当用户要求你创建新的 git 提交时，请仔细遵循以下步骤：

你可以在单条响应中调用多个工具。当请求了多个独立信息且所有命令都可能成功时，并行运行多个工具调用以获得最佳性能。以下编号步骤指示哪些命令应该批量并行执行。

Git 安全协议：
- 绝不更新 git 配置
- 绝不运行破坏性的 git 命令（push --force、reset --hard、checkout .、restore .、clean -f、branch -D），除非用户明确要求这些操作。未经授权的破坏性操作是有害的，可能导致工作丢失，所以最好只在收到明确指令时才运行这些命令
- 绝不跳过钩子（--no-verify、--no-gpg-sign 等），除非用户明确要求
- 绝不向 main/master 强制推送，如果用户要求请警告
- 关键提示：始终创建新提交而不是修改，除非用户明确要求 git amend。当预提交钩子失败时，提交未发生——所以 --amend 会修改上一个提交，可能导致工作丢失或先前更改丢失。相反，钩子失败后，修复问题，重新暂存，并创建新提交
- 暂存文件时，优先按名称添加特定文件，而不是使用"git add -A"或"git add ."，后者可能意外包含敏感文件（.env、凭据）或大型二进制文件
- 除非用户明确要求，否则绝不提交更改。只在明确被要求时才提交非常重要，否则用户会觉得你过于主动

1. 使用 ${BASH_TOOL_NAME} 工具并行运行以下 bash 命令：
  - 运行 git status 命令查看所有未跟踪的文件。重要：绝不使用 -uall 标志，因为在大型仓库上可能导致内存问题。
  - 运行 git diff 命令查看将要提交的暂存和未暂存的更改。
  - 运行 git log 命令查看最近的提交消息，以便遵循此仓库的提交消息风格。
2. 分析所有暂存的更改（先前暂存的和新添加的），起草提交消息：
  - 总结更改的性质（例如，新功能、对现有功能的增强、bug 修复、重构、测试、文档等）。确保消息准确反映更改及其目的（即"add"表示全新功能，"update"表示对现有功能的增强，"fix"表示 bug 修复等）。
  - 不要提交可能包含机密的文件（.env、credentials.json 等）。如果用户特别要求提交这些文件，请警告
  - 起草一条简洁的（1-2 句）提交消息，侧重于"为什么"而非"是什么"
  - 确保它准确反映更改及其目的
3. 并行运行以下命令：
   - 将相关的未跟踪文件添加到暂存区。
   - 创建提交，消息${commitAttribution ? `以以下内容结尾：\n   ${commitAttribution}` : '。'}
   - 提交完成后运行 git status 验证是否成功。
   注意：git status 依赖提交完成，所以在提交后顺序运行。
4. 如果提交因预提交钩子失败：修复问题并创建新提交

重要说明：
- 绝不运行额外的命令来读取或探索代码，除了 git bash 命令
- 绝不使用 ${TodoWriteTool.name} 或 ${AGENT_TOOL_NAME} 工具
- 除非用户明确要求，否则不要推送到远程仓库
- 重要提示：绝不使用带 -i 标志的 git 命令（如 git rebase -i 或 git add -i），因为它们需要不支持的交互式输入。
- 重要提示：不要在 git rebase 命令中使用 --no-edit，因为 --no-edit 标志对 git rebase 无效。
- 如果没有要提交的更改（即没有未跟踪的文件且没有修改），不要创建空提交
- 为确保格式正确，始终通过 HEREDOC 传递提交消息，示例如下：
<example>
git commit -m "$(cat <<'EOF'
   提交消息内容。${commitAttribution ? `\n\n   ${commitAttribution}` : ''}
   EOF
   )"
</example>

# 创建拉取请求
使用 Bash 工具中的 gh 命令处理所有 GitHub 相关任务，包括处理 issue、拉取请求、检查和发布。如果给出了 GitHub URL，请使用 gh 命令获取所需信息。

重要提示：当用户要求你创建拉取请求时，请仔细遵循以下步骤：

1. 使用 ${BASH_TOOL_NAME} 工具并行运行以下 bash 命令，以了解分支自从从主分支分叉以来的当前状态：
   - 运行 git status 命令查看所有未跟踪的文件（绝不使用 -uall 标志）
   - 运行 git diff 命令查看将要提交的暂存和未暂存的更改
   - 检查当前分支是否跟踪远程分支并与远程保持同步，以便了解是否需要推送到远程
   - 运行 git log 命令和 \`git diff [base-branch]...HEAD\` 了解当前分支的完整提交历史（从它从基础分支分叉的时间起）
2. 分析将包含在拉取请求中的所有更改，确保查看所有相关提交（不仅仅是最新提交，而是将包含在 PR 中的所有提交！！！），并起草拉取请求标题和摘要：
   - 保持 PR 标题简短（70 个字符以内）
   - 详情放在描述/正文中，而非标题
3. 并行运行以下命令：
   - 如有需要创建新分支
   - 如有需要使用 -u 标志推送到远程
   - 使用如下格式通过 gh pr create 创建 PR。使用 HEREDOC 传递正文以确保格式正确。
<example>
gh pr create --title "pr 标题" --body "$(cat <<'EOF'
## 摘要
<1-3 个要点>

## 测试计划
[测试拉取请求的待办事项 Markdown 清单...]${prAttribution ? `\n\n${prAttribution}` : ''}
EOF
)"
</example>

重要事项：
- 不要使用 ${TodoWriteTool.name} 或 ${AGENT_TOOL_NAME} 工具
- 完成后返回 PR URL，以便用户查看

# 其他常用操作
- 查看 Github PR 上的评论：gh api repos/foo/bar/pulls/123/comments`
}

// SandboxManager merges config from multiple sources (settings layers, defaults,
// CLI flags) without deduping, so paths like ~/.cache appear 3× in allowOnly.
// Dedup here before inlining into the prompt — affects only what the model sees,
// not sandbox enforcement. Saves ~150-200 tokens/request when sandbox is enabled.
function dedup<T>(arr: T[] | undefined): T[] | undefined {
  if (!arr || arr.length === 0) return arr
  return [...new Set(arr)]
}

function getSimpleSandboxSection(): string {
  if (!SandboxManager.isSandboxingEnabled()) {
    return ''
  }

  const fsReadConfig = SandboxManager.getFsReadConfig()
  const fsWriteConfig = SandboxManager.getFsWriteConfig()
  const networkRestrictionConfig = SandboxManager.getNetworkRestrictionConfig()
  const allowUnixSockets = SandboxManager.getAllowUnixSockets()
  const ignoreViolations = SandboxManager.getIgnoreViolations()
  const allowUnsandboxedCommands =
    SandboxManager.areUnsandboxedCommandsAllowed()

  // Replace the per-UID temp dir literal (e.g. /private/tmp/claude-1001/) with
  // "$TMPDIR" so the prompt is identical across users — avoids busting the
  // cross-user global prompt cache. The sandbox already sets $TMPDIR at runtime.
  const claudeTempDir = getClaudeTempDir()
  const normalizeAllowOnly = (paths: string[]): string[] =>
    [...new Set(paths)].map(p => (p === claudeTempDir ? '$TMPDIR' : p))

  const filesystemConfig = {
    read: {
      denyOnly: dedup(fsReadConfig.denyOnly),
      ...(fsReadConfig.allowWithinDeny && {
        allowWithinDeny: dedup(fsReadConfig.allowWithinDeny),
      }),
    },
    write: {
      allowOnly: normalizeAllowOnly(fsWriteConfig.allowOnly),
      denyWithinAllow: dedup(fsWriteConfig.denyWithinAllow),
    },
  }

  const networkConfig = {
    ...(networkRestrictionConfig?.allowedHosts && {
      allowedHosts: dedup(networkRestrictionConfig.allowedHosts),
    }),
    ...(networkRestrictionConfig?.deniedHosts && {
      deniedHosts: dedup(networkRestrictionConfig.deniedHosts),
    }),
    ...(allowUnixSockets && { allowUnixSockets: dedup(allowUnixSockets) }),
  }

  const restrictionsLines = []
  if (Object.keys(filesystemConfig).length > 0) {
    restrictionsLines.push(`Filesystem: ${jsonStringify(filesystemConfig)}`)
  }
  if (Object.keys(networkConfig).length > 0) {
    restrictionsLines.push(`Network: ${jsonStringify(networkConfig)}`)
  }
  if (ignoreViolations) {
    restrictionsLines.push(
      `Ignored violations: ${jsonStringify(ignoreViolations)}`,
    )
  }

  const sandboxOverrideItems: Array<string | string[]> =
    allowUnsandboxedCommands
      ? [
          '你应该始终默认在沙盒内运行命令。不要尝试设置 `dangerouslyDisableSandbox: true`，除非：',
          [
            '用户*明确*要求绕过沙盒',
            '某个特定命令刚刚失败，并且你看到沙盒限制导致失败的证据。请注意，命令可能因与沙盒无关的许多原因失败（文件缺失、错误参数、网络问题等）。',
          ],
          '沙盒导致失败的证据包括：',
          [
            '文件/网络操作的"Operation not permitted"错误',
            '访问允许目录之外的特定路径被拒绝',
            '连接非白名单主机的网络连接失败',
            'Unix socket 连接错误',
          ],
          '当你看到沙盒导致失败的证据时：',
          [
            '立即用 `dangerouslyDisableSandbox: true` 重试（不要询问，直接执行）',
            '简要解释沙盒限制可能导致失败的原因。务必提醒用户可以使用 `/sandbox` 命令管理限制。',
            '这将提示用户授权',
          ],
          '对每个使用 `dangerouslyDisableSandbox: true` 执行的命令单独处理。即使你最近运行了带此设置的命令，未来的命令也应默认在沙盒内运行。',
          '不要建议将敏感路径如 ~/.bashrc、~/.zshrc、~/.ssh/* 或凭据文件添加到沙盒允许列表中。',
        ]
      : [
          '所有命令必须在沙盒模式下运行——`dangerouslyDisableSandbox` 参数已被策略禁用。',
          '命令在任何情况下都不能在沙盒外运行。',
          '如果命令因沙盒限制而失败，请与用户协商调整沙盒设置。',
        ]

  const items: Array<string | string[]> = [
    ...sandboxOverrideItems,
    '对于临时文件，始终使用 `$TMPDIR` 环境变量。在沙盒模式下，TMPDIR 会自动设置为正确的沙盒可写目录。不要直接使用 `/tmp`——请改用 `$TMPDIR`。',
  ]

  return [
    '',
    '## 命令沙盒',
    '默认情况下，你的命令将在沙盒中运行。此沙盒控制命令可以访问或修改哪些目录和网络主机，无需显式覆盖。',
    '',
    '沙盒有以下限制：',
    restrictionsLines.join('\n'),
    '',
    ...prependBullets(items),
  ].join('\n')
}

export function getSimplePrompt(): string {
  // Ant-native builds alias find/grep to embedded bfs/ugrep in Claude's shell,
  // so we don't steer away from them (and Glob/Grep tools are removed).
  const embedded = hasEmbeddedSearchTools()

  const toolPreferenceItems = [
    ...(embedded
      ? []
      : [
          `文件搜索：使用 ${GLOB_TOOL_NAME}（不要用 find 或 ls）`,
          `内容搜索：使用 ${GREP_TOOL_NAME}（不要用 grep 或 rg）`,
        ]),
    `读取文件：使用 ${FILE_READ_TOOL_NAME}（不要用 cat/head/tail）`,
    `编辑文件：使用 ${FILE_EDIT_TOOL_NAME}（不要用 sed/awk）`,
    `写入文件：使用 ${FILE_WRITE_TOOL_NAME}（不要用 echo >/cat <<EOF）`,
    '通信：直接输出文字（不要用 echo/printf）',
  ]

  const avoidCommands = embedded
    ? '`cat`、`head`、`tail`、`sed`、`awk` 或 `echo`'
    : '`find`、`grep`、`cat`、`head`、`tail`、`sed`、`awk` 或 `echo`'

  const multipleCommandsSubitems = [
    `如果命令相互独立可以并行运行，在单条消息中进行多次 ${BASH_TOOL_NAME} 工具调用。示例：如果需要运行"git status"和"git diff"，请发送一条包含两个并行 ${BASH_TOOL_NAME} 工具调用的消息。`,
    `如果命令相互依赖必须顺序运行，使用单次 ${BASH_TOOL_NAME} 调用并用 '&&' 链式连接。`,
    "仅当需要顺序运行但不关心前面命令是否失败时才使用 ';'。",
    '不要用换行符分隔命令（换行在引号字符串中是可以的）。',
  ]

  const gitSubitems = [
    '优先创建新提交而不是修改已有提交。',
    '在运行破坏性操作之前（例如 git reset --hard、git push --force、git checkout --），考虑是否有更安全的替代方案能达到相同目标。只在这些操作确实是最佳方法时才使用。',
    '除非用户明确要求，否则绝不跳过钩子（--no-verify）或绕过签名（--no-gpg-sign、-c commit.gpgsign=false）。如果钩子失败，请调查并修复根本问题。',
  ]

  const sleepSubitems = [
    '不要在可以立即运行的命令之间加入休眠——直接运行即可。',
    ...(feature('MONITOR_TOOL')
      ? [
          '使用 Monitor 工具从后台进程流式传输事件（每行 stdout 就是一条通知）。对于一次性的"等待完成"，改用带 run_in_background 的 Bash。',
        ]
      : []),
    '如果你的命令运行时间较长，希望完成时收到通知——使用 `run_in_background`。不需要休眠。',
    '不要在休眠循环中重试失败的命令——诊断根本原因。',
    '如果在等待用 `run_in_background` 启动的后台任务，完成时你会收到通知——不要轮询。',
    ...(feature('MONITOR_TOOL')
      ? [
          '首个命令为 N ≥ 2 的 `sleep N` 被阻止。如果需要延迟（限速、刻意节奏），请保持在 2 秒以内。',
        ]
      : [
          '如果必须轮询外部进程，使用检查命令（例如 `gh run view`）而不是先休眠。',
          '如果必须休眠，请保持时间较短（1-5 秒），以避免阻塞用户。',
        ]),
  ]
  const backgroundNote = getBackgroundUsageNote()

  const instructionItems: Array<string | string[]> = [
    '如果你的命令将创建新目录或文件，请先使用此工具运行 `ls` 验证父目录存在且位置正确。',
    '命令中包含空格的文件路径始终用双引号引起来（例如，cd "path with spaces/file.txt"）',
    '尽量在整个会话中使用绝对路径并避免使用 `cd` 来保持当前工作目录不变。如果用户明确要求，你可以使用 `cd`。',
    `You may specify an optional timeout in milliseconds (up to ${getMaxTimeoutMs()}ms / ${getMaxTimeoutMs() / 60000} minutes). By default, your command will timeout after ${getDefaultTimeoutMs()}ms (${getDefaultTimeoutMs() / 60000} minutes).`,
    ...(backgroundNote !== null ? [backgroundNote] : []),
    '发出多条命令时：',
    multipleCommandsSubitems,
    '对于 git 命令：',
    gitSubitems,
    '避免不必要的 `sleep` 命令：',
    sleepSubitems,
    ...(embedded
      ? [
          // bfs (which backs `find`) uses Oniguruma for -regex, which picks the
          // FIRST matching alternative (leftmost-first), unlike GNU find's
          // POSIX leftmost-longest. This silently drops matches when a shorter
          // alternative is a prefix of a longer one.
          "使用 `find -regex` 带交替模式时，将最长的替代项放在前面。示例：使用 `'.*\\.\\(tsx\\|ts\\)'` 而不是 `'.*\\.\\(ts\\|tsx\\)'`——第二种形式会静默跳过 `.tsx` 文件。",
        ]
      : []),
  ]

  return [
    '执行给定的 bash 命令并返回其输出。',
    '',
    "工作目录在命令之间持久保留，但 shell 状态不保留。Shell 环境从用户的配置文件（bash 或 zsh）初始化。",
    '',
    `重要提示：避免使用此工具运行 ${avoidCommands} 命令，除非明确被要求或已验证专用工具无法完成任务。请改用相应的专用工具，这将为用户提供更好的体验：`,
    '',
    ...prependBullets(toolPreferenceItems),
    `While the ${BASH_TOOL_NAME} tool can do similar things, it’s better to use the built-in tools as they provide a better user experience and make it easier to review tool calls and give permission.`,
    '',
    '# 使用说明',
    ...prependBullets(instructionItems),
    getSimpleSandboxSection(),
    ...(getCommitAndPRInstructions() ? ['', getCommitAndPRInstructions()] : []),
  ].join('\n')
}
