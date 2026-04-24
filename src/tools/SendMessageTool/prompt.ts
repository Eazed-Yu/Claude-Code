import { feature } from 'bun:bundle'

export const DESCRIPTION = '向另一个代理发送消息'

export function getPrompt(): string {
  const udsRow = feature('UDS_INBOX')
    ? `\n| \`"uds:/path/to.sock"\` | Local Claude session's socket (same machine; use \`ListPeers\`) |
| \`"bridge:session_..."\` | Remote Control peer session (cross-machine; use \`ListPeers\`) |`
    : ''
  const udsSection = feature('UDS_INBOX')
    ? `\n\n## 跨会话

使用 \`ListPeers\` 发现目标，然后：

\`\`\`json
{"to": "uds:/tmp/cc-socks/1234.sock", "message": "check if tests pass over there"}
{"to": "bridge:session_01AbCd...", "message": "what branch are you on?"}
\`\`\`

已列出的 peer 处于活跃状态并将处理你的消息——没有"忙碌"状态；消息会在接收方的下一个工具轮次中排队并被处理。你的消息到达时被包装为 \`<cross-session-message from="...">\`。**若要回复传入消息，请将其 \`from\` 属性复制为你的 \`to\`。**`
    : ''
  return `
# SendMessage

向另一个代理发送消息。

\`\`\`json
{"to": "researcher", "summary": "assign task 1", "message": "start on task #1"}
\`\`\`

| \`to\` | |
|---|---|
| \`"researcher"\` | 按名称指定队友 |
| \`"*"\` | 广播给所有队友——代价高（线性于团队规模），仅在每个人都真正需要时使用 |${udsRow}

你的纯文本输出对其他代理不可见——要进行通信，你必须调用此工具。来自队友的消息会自动传递；你不需要检查收件箱。按名称引用队友，不要用 UUID。转发消息时，不要引用原文——它已经渲染给用户了。${udsSection}

## 协议响应（旧版）

如果你收到带有 \`type: "shutdown_request"\` 或 \`type: "plan_approval_request"\` 的 JSON 消息，请用匹配的 \`_response\` 类型回复——复制 \`request_id\`，设置 \`approve\` 为 true/false：

\`\`\`json
{"to": "team-lead", "message": {"type": "shutdown_response", "request_id": "...", "approve": true}}
{"to": "researcher", "message": {"type": "plan_approval_response", "request_id": "...", "approve": false, "feedback": "add error handling"}}
\`\`\`

批准关闭会终止你的进程。拒绝计划会让队友返回修改。除非被要求，否则不要发起 \`shutdown_request\`。不要发送结构化的 JSON 状态消息——使用 TaskUpdate。
`.trim()
}
