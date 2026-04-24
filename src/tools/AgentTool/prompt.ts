import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { getSubscriptionType } from '../../utils/auth.js'
import { hasEmbeddedSearchTools } from '../../utils/embeddedTools.js'
import { isEnvDefinedFalsy, isEnvTruthy } from '../../utils/envUtils.js'
import { isTeammate } from '../../utils/teammate.js'
import { isInProcessTeammate } from '../../utils/teammateContext.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../GlobTool/prompt.js'
import { SEND_MESSAGE_TOOL_NAME } from '../SendMessageTool/constants.js'
import { AGENT_TOOL_NAME } from './constants.js'
import { isForkSubagentEnabled } from './forkSubagent.js'
import type { AgentDefinition } from './loadAgentsDir.js'

function getToolsDescription(agent: AgentDefinition): string {
  const { tools, disallowedTools } = agent
  const hasAllowlist = tools && tools.length > 0
  const hasDenylist = disallowedTools && disallowedTools.length > 0

  if (hasAllowlist && hasDenylist) {
    // Both defined: filter allowlist by denylist to match runtime behavior
    const denySet = new Set(disallowedTools)
    const effectiveTools = tools.filter(t => !denySet.has(t))
    if (effectiveTools.length === 0) {
      return '无'
    }
    return effectiveTools.join(', ')
  } else if (hasAllowlist) {
    // Allowlist only: show the specific tools available
    return tools.join(', ')
  } else if (hasDenylist) {
    // Denylist only: show "All tools except X, Y, Z"
    return `所有工具（排除 ${disallowedTools.join(', ')}）`
  }
  // No restrictions
  return '所有工具'
}

/**
 * Format one agent line for the agent_listing_delta attachment message:
 * `- type: whenToUse (Tools: ...)`.
 */
export function formatAgentLine(agent: AgentDefinition): string {
  const toolsDescription = getToolsDescription(agent)
  return `- ${agent.agentType}: ${agent.whenToUse} (Tools: ${toolsDescription})`
}

/**
 * Whether the agent list should be injected as an attachment message instead
 * of embedded in the tool description. When true, getPrompt() returns a static
 * description and attachments.ts emits an agent_listing_delta attachment.
 *
 * The dynamic agent list was ~10.2% of fleet cache_creation tokens: MCP async
 * connect, /reload-plugins, or permission-mode changes mutate the list →
 * description changes → full tool-schema cache bust.
 *
 * Override with CLAUDE_CODE_AGENT_LIST_IN_MESSAGES=true/false for testing.
 */
export function shouldInjectAgentListInMessages(): boolean {
  if (isEnvTruthy(process.env.CLAUDE_CODE_AGENT_LIST_IN_MESSAGES)) return true
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_AGENT_LIST_IN_MESSAGES))
    return false
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_agent_list_attach', false)
}

export async function getPrompt(
  agentDefinitions: AgentDefinition[],
  isCoordinator?: boolean,
  allowedAgentTypes?: string[],
): Promise<string> {
  // Filter agents by allowed types when Agent(x,y) restricts which agents can be spawned
  const effectiveAgents = allowedAgentTypes
    ? agentDefinitions.filter(a => allowedAgentTypes.includes(a.agentType))
    : agentDefinitions

  // Fork subagent feature: when enabled, insert the "When to fork" section
  // (fork semantics, directive-style prompts) and swap in fork-aware examples.
  const forkEnabled = isForkSubagentEnabled()

  const whenToForkSection = forkEnabled
    ? `

## 何时创建 fork

当中间工具输出不值得保留在上下文中时，fork 自身（省略 \`subagent_type\`）。判断标准是定性的——"我以后还需要这个输出吗"——而非任务规模。
- **研究**：对开放性问题使用 fork。如果研究可以分解为独立问题，在一条消息中并行启动多个 fork。对此而言 fork 优于新建子代理——它继承上下文并共享你的缓存。
- **实现**：对于需要超过几处编辑的实现工作，优先使用 fork。在跳入实现之前先做研究。

fork 代价低廉，因为它们共享你的提示词缓存。不要在 fork 上设置 \`model\`——不同模型无法复用父级缓存。传入简短的 \`name\`（一两个词，小写），这样用户可以在团队面板中看到 fork 并在运行中随时介入。

**不要偷看。** 工具结果中包含 \`output_file\` 路径——除非用户明确要求进度检查，否则不要读取或追踪它。你会收到完成通知，相信它即可。在 fork 运行中途读取其记录会将 fork 的工具噪音引入你的上下文，这违背了 fork 的初衷。

**不要抢先。** 启动之后，你对 fork 的发现一无所知。绝不以任何形式捏造或预测 fork 结果——无论是散文、摘要还是结构化输出。通知以用户角色消息的形式在后续轮次中出现；它永远不是你自己写的。如果用户在通知到达之前询问后续问题，告诉他们 fork 仍在运行——给出状态，不是猜测。

**编写 fork 提示词。** 由于 fork 继承了你的上下文，提示词是一个*指令*——要做什么，而不是情况是什么。明确说明范围：哪些在内，哪些在外，另一个代理在处理什么。不要重新解释背景。
`
    : ''

  const writingThePromptSection = `

## 编写提示词

${forkEnabled ? '当生成新的代理（带 `subagent_type`）时，它从零上下文开始。' : ''}像向刚走进房间的聪明同事简述任务一样——它没有看过这段对话，不知道你尝试过什么，不理解这个任务为何重要。
- 解释你想完成什么以及为什么。
- 描述你已经了解或排除的内容。
- 提供足够的周边问题背景，让代理能够做出判断而不只是遵循狭窄的指令。
- 如果你需要简短的回应，请明确说明（"在 200 字以内汇报"）。
- 查找类任务：直接给出确切命令。调查类任务：给出问题——当前提有误时，规定步骤会变成死重量。

${forkEnabled ? '对于新代理，简短' : '简短'}的命令式提示词会产生浅显、泛泛的结果。

**绝不把理解委托出去。** 不要写"根据你的发现，修复这个 bug"或"根据研究，实现它"。这些表述将综合分析推给代理，而不是你自己完成。编写能证明你已经理解的提示词：包含文件路径、行号、具体要修改什么。
`

  const forkExamples = `示例用法：

<example>
用户："这个分支在发布前还有什么要做的？"
assistant: <thinking>fork 这个——这是一个调查性问题。我想要清单，而不是 git 输出在我的上下文里。</thinking>
${AGENT_TOOL_NAME}({
  name: "ship-audit",
  description: "分支发布就绪性审计",
  prompt: "审计这个分支在发布前还有什么要做。检查：未提交的更改、领先 main 的提交数、是否存在测试、GrowthBook 开关是否已接入、是否有 CI 相关文件发生变化。报告清单——已完成的和缺失的。200 字以内。"
})
assistant: 发布就绪性审计正在运行。
<commentary>
轮次在此结束。协调员对发现结果一无所知。以下是独立的轮次——通知以外部方式作为用户角色消息到达。这不是协调员自己写的内容。
</commentary>
[后续轮次——通知作为用户消息到达]
assistant: 审计结果回来了。三个阻塞项：新提示词路径没有测试，GrowthBook 开关已接入但不在 build_flags.yaml 中，还有一个未提交的文件。
</example>

<example>
用户："那这个开关到底接好了没有"
<commentary>
用户在等待中询问。审计 fork 正是为了回答这个问题而启动的，但尚未返回。协调员没有答案。给出状态，不是捏造的结果。
</commentary>
assistant: 还在等待审计结果——这正是它正在检查的内容之一。马上就好。
</example>

<example>
用户："你能就这次迁移是否安全给出第二意见吗？"
assistant: <thinking>我会请 code-reviewer 代理——它看不到我的分析，所以可以给出独立意见。</thinking>
<commentary>
指定了 subagent_type，所以代理从零上下文开始。它需要提示词中的完整上下文。简报解释了要评估什么以及为什么。
</commentary>
${AGENT_TOOL_NAME}({
  name: "migration-review",
  description: "独立迁移审查",
  subagent_type: "code-reviewer",
  prompt: "审查迁移文件 0042_user_schema.sql 的安全性。背景：我们正在向一张 5000 万行的表中添加 NOT NULL 列。现有行会获得回填默认值。我想就回填方案在并发写入下是否安全获取第二意见——我已检查了锁机制但想要独立验证。报告：这是否安全，如果不安全，具体会出什么问题？"
})
</example>
`

  const currentExamples = `示例用法：

<example_agent_descriptions>
"test-runner": 完成代码编写后使用此代理运行测试
"greeting-responder": 使用此代理以友好的笑话回应用户问候
</example_agent_descriptions>

<example>
用户："请写一个检查数字是否为质数的函数"
assistant: 我将使用 ${FILE_WRITE_TOOL_NAME} 工具编写以下代码：
<code>
function isPrime(n) {
  if (n <= 1) return false
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false
  }
  return true
}
</code>
<commentary>
由于编写了一段重要代码且任务已完成，现在使用 test-runner 代理运行测试
</commentary>
assistant: 使用 ${AGENT_TOOL_NAME} 工具启动 test-runner 代理
</example>

<example>
用户："你好"
<commentary>
由于用户在打招呼，使用 greeting-responder 代理以友好的笑话回应
</commentary>
assistant: "我将使用 ${AGENT_TOOL_NAME} 工具启动 greeting-responder 代理"
</example>
`

  // When the gate is on, the agent list lives in an agent_listing_delta
  // attachment (see attachments.ts) instead of inline here. This keeps the
  // tool description static across MCP/plugin/permission changes so the
  // tools-block prompt cache doesn't bust every time an agent loads.
  const listViaAttachment = shouldInjectAgentListInMessages()

  const agentListSection = listViaAttachment
    ? `可用的代理类型列在对话中的 <system-reminder> 消息中。`
    : `可用的代理类型及其可访问的工具：
${effectiveAgents.map(agent => formatAgentLine(agent)).join('\n')}`

  // Shared core prompt used by both coordinator and non-coordinator modes
  const shared = `启动新代理以自主处理复杂的多步骤任务。

${AGENT_TOOL_NAME} 工具启动专业代理（子进程），这些代理可以自主处理复杂任务。每种代理类型都有其特定的能力和可用工具。

${agentListSection}

${
  forkEnabled
    ? `使用 ${AGENT_TOOL_NAME} 工具时，指定 subagent_type 以使用专业代理，或省略以 fork 自身——fork 会继承你的完整对话上下文。`
    : `使用 ${AGENT_TOOL_NAME} 工具时，指定 subagent_type 参数以选择使用哪种代理类型。如果省略，则使用通用代理。`
}`

  // Coordinator mode gets the slim prompt -- the coordinator system prompt
  // already covers usage notes, examples, and when-not-to-use guidance.
  if (isCoordinator) {
    return shared
  }

  // Ant-native builds alias find/grep to embedded bfs/ugrep and remove the
  // dedicated Glob/Grep tools, so point at find via Bash instead.
  const embedded = hasEmbeddedSearchTools()
  const fileSearchHint = embedded
    ? '`find` via the Bash tool'
    : `the ${GLOB_TOOL_NAME} tool`
  // The "class Foo" example is about content search. Non-embedded stays Glob
  // (original intent: find-the-file-containing). Embedded gets grep because
  // find -name doesn't look at file contents.
  const contentSearchHint = embedded
    ? '`grep` via the Bash tool'
    : `the ${GLOB_TOOL_NAME} tool`
  const whenNotToUseSection = forkEnabled
    ? ''
    : `
不应使用 ${AGENT_TOOL_NAME} 工具的情况：
- 如果你想读取特定文件路径，请使用 ${FILE_READ_TOOL_NAME} 工具或 ${fileSearchHint}，而不是 ${AGENT_TOOL_NAME} 工具，这样可以更快找到匹配
- 如果你在搜索特定类定义，如"class Foo"，请使用 ${contentSearchHint}，这样可以更快找到匹配
- 如果你在特定文件或 2-3 个文件集合中搜索代码，请使用 ${FILE_READ_TOOL_NAME} 工具而不是 ${AGENT_TOOL_NAME} 工具，这样可以更快找到匹配
- 其他与上述代理描述无关的任务
`

  // When listing via attachment, the "launch multiple agents" note is in the
  // attachment message (conditioned on subscription there). When inline, keep
  // the existing per-call getSubscriptionType() check.
  const concurrencyNote =
    !listViaAttachment && getSubscriptionType() !== 'pro'
      ? `
- 尽可能并发启动多个代理以最大化性能；为此，请在单条消息中使用多个工具调用`
      : ''

  // Non-coordinator gets the full prompt with all sections
  return `${shared}
${whenNotToUseSection}

使用说明：
- 始终包含一段简短描述（3-5 个词），概括代理将要做什么${concurrencyNote}
- 代理完成后，它会向你返回一条消息。代理返回的结果对用户不可见。要向用户展示结果，你应该向用户发送一条文本消息，简洁地总结结果。${
    // eslint-disable-next-line custom-rules/no-process-env-top-level
    !isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS) &&
    !isInProcessTeammate() &&
    !forkEnabled
      ? `
- 你可以选择使用 run_in_background 参数在后台运行代理。当代理在后台运行时，完成后你会自动收到通知——不要休眠、轮询或主动检查其进度。继续其他工作或回应用户即可。
- **前台 vs 后台**：当你需要代理的结果才能继续时使用前台（默认）——例如，研究代理的发现会影响你的下一步。当你有真正独立的并行工作要做时使用后台。`
      : ''
  }
- 要继续之前启动的代理，请使用 ${SEND_MESSAGE_TOOL_NAME}，将代理的 ID 或名称作为 \`to\` 字段。代理会在完整上下文保留的情况下继续。${forkEnabled ? '每次带有 subagent_type 的新 Agent 调用都从零上下文开始——请提供完整的任务描述。' : '每次 Agent 调用都从零上下文开始——请提供完整的任务描述。'}
- 代理的输出通常应当信任
- 明确告知代理你期望它编写代码还是仅做研究（搜索、读取文件、网页获取等）${forkEnabled ? '' : '，因为它不知道用户的意图'}
- 如果代理描述中提到应该主动使用它，那么你应该尽量在用户不必主动要求的情况下使用它。请自行判断。
- 如果用户指定要"并行"运行代理，你必须发送一条包含多个 ${AGENT_TOOL_NAME} 工具调用内容块的单条消息。例如，如果需要并行启动 build-validator 代理和 test-runner 代理，请在单条消息中同时包含两个工具调用。
- 你可以选择设置 \`isolation: "worktree"\` 在临时 git worktree 中运行代理，为其提供仓库的隔离副本。如果代理未作任何更改，worktree 会自动清理；如果有更改，则在结果中返回 worktree 路径和分支名。${
    process.env.USER_TYPE === 'ant'
      ? `\n- 你可以设置 \`isolation: "remote"\` 在远程 CCR 环境中运行代理。这始终是后台任务；完成后你会收到通知。适用于需要全新沙盒的长时间运行任务。`
      : ''
  }${
    isInProcessTeammate()
      ? `
- run_in_background、name、team_name 和 mode 参数在此上下文中不可用。仅支持同步子代理。`
      : isTeammate()
        ? `
- name、team_name 和 mode 参数在此上下文中不可用——队友不能生成其他队友。省略这些参数以生成子代理。`
        : ''
  }${whenToForkSection}${writingThePromptSection}

${forkEnabled ? forkExamples : currentExamples}`
}
