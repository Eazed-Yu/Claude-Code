export function getPrompt(): string {
  return `
# TeamDelete

当群组工作完成后，移除团队和任务目录。

此操作将：
- 移除团队目录（\`~/.claude/teams/{team-name}/\`）
- 移除任务目录（\`~/.claude/tasks/{team-name}/\`）
- 从当前会话中清除团队上下文

**重要提示**：如果团队仍有活跃成员，TeamDelete 将失败。请先优雅地终止所有队友，待所有队友关闭后再调用 TeamDelete。

当所有队友都完成了工作，你想清理团队资源时使用此工具。团队名称会自动从当前会话的团队上下文中确定。
`.trim()
}
