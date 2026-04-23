export const REMOTE_TRIGGER_TOOL_NAME = 'RemoteTrigger'

export const DESCRIPTION =
  '通过 claude.ai CCR API 管理已计划的远程 Claude Code 代理（触发器）。认证在进程内处理——token 不会到达 shell。'

export const PROMPT = `调用 claude.ai 远程触发器 API。请使用此工具而非 curl——OAuth token 会在进程内自动添加，永远不会暴露。

操作：
- list: GET /v1/code/triggers
- get: GET /v1/code/triggers/{trigger_id}
- create: POST /v1/code/triggers（需要请求体）
- update: POST /v1/code/triggers/{trigger_id}（需要请求体，部分更新）
- run: POST /v1/code/triggers/{trigger_id}/run

响应为 API 返回的原始 JSON。`
