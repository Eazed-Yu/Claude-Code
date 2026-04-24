export function getEnterWorktreeToolPrompt(): string {
  return `仅当用户明确要求在 worktree 中工作时才使用此工具。此工具会创建一个隔离的 git worktree，并将当前会话切换到其中。

## 何时使用

- 用户明确提到"worktree"（例如"启动一个 worktree"、"在 worktree 中工作"、"创建一个 worktree"、"使用 worktree"）

## 何时不应使用

- 用户要求创建分支、切换分支或在不同分支上工作——请改用 git 命令
- 用户要求修复 bug 或开发功能——除非用户明确提到 worktree，否则使用正常的 git 工作流
- 除非用户明确提到"worktree"，否则绝不使用此工具

## 要求

- 必须处于 git 仓库中，或在 settings.json 中配置了 WorktreeCreate/WorktreeRemove 钩子
- 当前不能已在 worktree 中

## 行为

- 在 git 仓库中：在 \`.claude/worktrees/\` 内创建一个新的 git worktree，基于 HEAD 创建新分支
- 在 git 仓库外：委托给 WorktreeCreate/WorktreeRemove 钩子以实现 VCS 无关的隔离
- 将会话的工作目录切换到新 worktree
- 使用 ExitWorktree 可在会话中途离开 worktree（保留或删除）。会话退出时如果仍在 worktree 中，系统会提示用户选择保留或删除

## 参数

- \`name\`（可选）：worktree 的名称。如果未提供，则自动生成随机名称。
`
}
