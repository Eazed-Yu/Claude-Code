export function getExitWorktreeToolPrompt(): string {
  return `退出由 EnterWorktree 创建的 worktree 会话，将会话返回到原始工作目录。

## 范围

此工具仅操作本次会话中由 EnterWorktree 创建的 worktree。它不会触及：
- 你使用 \`git worktree add\` 手动创建的 worktree
- 上一次会话中的 worktree（即使当时是由 EnterWorktree 创建的）
- 如果从未调用 EnterWorktree，则不操作你当前所在的目录

如果在 EnterWorktree 会话之外调用，此工具为**空操作**：它会报告没有活跃的 worktree 会话，不执行任何操作。文件系统状态不变。

## 何时使用

- 用户明确要求"退出 worktree"、"离开 worktree"、"返回"或以其他方式结束 worktree 会话
- 不要主动调用——仅在用户要求时才调用

## 参数

- \`action\`（必填）：\`"keep"\` 或 \`"remove"\`
  - \`"keep"\` — 保留磁盘上的 worktree 目录和分支。当用户想稍后返回该工作，或有需要保留的更改时使用。
  - \`"remove"\` — 删除 worktree 目录及其分支。当工作已完成或放弃，想要干净退出时使用。
- \`discard_changes\`（可选，默认 false）：仅在 \`action: "remove"\` 时有意义。如果 worktree 有未提交的文件或原始分支上没有的提交，工具将拒绝删除，除非此项设为 \`true\`。如果工具返回列出了更改的错误，请在以 \`discard_changes: true\` 重新调用前先与用户确认。

## 行为

- 将会话的工作目录恢复到进入 EnterWorktree 之前的位置
- 清除依赖于 CWD 的缓存（系统提示片段、memory 文件、plans 目录），使会话状态反映原始目录
- 如果有 tmux 会话附加到 worktree：\`remove\` 时终止，\`keep\` 时保持运行（返回其名称供用户重新附加）
- 退出后，可再次调用 EnterWorktree 创建新的 worktree
`
}
