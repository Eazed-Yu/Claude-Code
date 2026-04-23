import { feature } from 'bun:bundle'
import { getFeatureValue_CACHED_WITH_REFRESH } from '../../services/analytics/growthbook.js'
import { DEFAULT_CRON_JITTER_CONFIG } from '../../utils/cronTasks.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

const KAIROS_CRON_REFRESH_MS = 5 * 60 * 1000

export const DEFAULT_MAX_AGE_DAYS =
  DEFAULT_CRON_JITTER_CONFIG.recurringMaxAgeMs / (24 * 60 * 60 * 1000)

/**
 * Unified gate for the cron scheduling system. Combines the build-time
 * `feature('AGENT_TRIGGERS')` flag (dead code elimination) with the runtime
 * `tengu_kairos_cron` GrowthBook gate on a 5-minute refresh window.
 *
 * AGENT_TRIGGERS is independently shippable from KAIROS — the cron module
 * graph (cronScheduler/cronTasks/cronTasksLock/cron.ts + the three tools +
 * /loop skill) has zero imports into src/assistant/ and no feature('KAIROS')
 * calls. The REPL.tsx kairosEnabled read is safe:
 * kairosEnabled is unconditionally in AppStateStore with default false, so
 * when KAIROS is off the scheduler just gets assistantMode: false.
 *
 * Called from Tool.isEnabled() (lazy, post-init) and inside useEffect /
 * imperative setup, never at module scope — so the disk cache has had a
 * chance to populate.
 *
 * The default is `true` — /loop is GA (announced in changelog). GrowthBook
 * is disabled for Bedrock/Vertex/Foundry and when DISABLE_TELEMETRY /
 * CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC are set; a `false` default would
 * break /loop for those users (GH #31759). The GB gate now serves purely as
 * a fleet-wide kill switch — flipping it to `false` stops already-running
 * schedulers on their next isKilled poll tick, not just new ones.
 *
 * `CLAUDE_CODE_DISABLE_CRON` is a local override that wins over GB.
 */
export function isKairosCronEnabled(): boolean {
  return feature('AGENT_TRIGGERS')
    ? !isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_CRON) &&
        getFeatureValue_CACHED_WITH_REFRESH(
          'tengu_kairos_cron',
          true,
          KAIROS_CRON_REFRESH_MS,
        )
    : false
}

/**
 * Kill switch for disk-persistent (durable) cron tasks. Narrower than
 * {@link isKairosCronEnabled} — flipping this off forces `durable: false` at
 * the call() site, leaving session-only cron (in-memory, GA) untouched.
 *
 * Defaults to `true` so Bedrock/Vertex/Foundry and DISABLE_TELEMETRY users get
 * durable cron. Does NOT consult CLAUDE_CODE_DISABLE_CRON (that kills the whole
 * scheduler via isKairosCronEnabled).
 */
export function isDurableCronEnabled(): boolean {
  return getFeatureValue_CACHED_WITH_REFRESH(
    'tengu_kairos_cron_durable',
    true,
    KAIROS_CRON_REFRESH_MS,
  )
}

export const CRON_CREATE_TOOL_NAME = 'CronCreate'
export const CRON_DELETE_TOOL_NAME = 'CronDelete'
export const CRON_LIST_TOOL_NAME = 'CronList'

export function buildCronCreateDescription(durableEnabled: boolean): string {
  return durableEnabled
    ? '安排一个提示在未来某个时间运行——可以是基于 cron 计划的定期任务，也可以是在特定时间运行一次的任务。传入 durable: true 可持久化到 .claude/scheduled_tasks.json；否则仅在本次会话中有效。'
    : '在当前 Claude 会话中安排一个提示在未来某个时间运行——可以是基于 cron 计划的定期任务，也可以是在特定时间运行一次的任务。'
}

export function buildCronCreatePrompt(durableEnabled: boolean): string {
  const durabilitySection = durableEnabled
    ? `## 持久性

默认情况下（durable: false），任务仅存在于本次 Claude 会话中——不写入磁盘，Claude 退出时任务消失。传入 durable: true 可写入 .claude/scheduled_tasks.json，使任务在重启后仍然存在。仅当用户明确要求任务持续执行时才使用 durable: true（"每天都执行这个"、"永久设置这个"）。大多数"5 分钟后提醒我"/"过一小时提醒我"之类的请求应保持仅会话模式。`
    : `## 仅会话

任务仅存在于本次 Claude 会话中——不写入磁盘，Claude 退出时任务消失。`

  const durableRuntimeNote = durableEnabled
    ? '持久性任务会持久化到 .claude/scheduled_tasks.json，在会话重启后仍然存在——下次启动时自动恢复。REPL 关闭期间错过的单次持久性任务会在下次启动时提示补执行。仅会话任务随进程一起消失。 '
    : ''

  return `安排一个提示在未来某个时间加入队列。既适用于定期计划，也适用于单次提醒。

使用用户本地时区的标准 5 字段 cron：分钟 小时 日期 月份 星期。"0 9 * * *" 表示本地时间早上 9 点——无需时区转换。

## 单次任务（recurring: false）

适用于"在 X 时提醒我"或"在 <某时间>，执行 Y"的请求——触发一次后自动删除。
将分钟/小时/日期/月份固定为具体值：
  "今天下午 2:30 提醒我检查部署" → cron: "30 14 <今天日期> <今天月份> *", recurring: false
  "明天早上运行冒烟测试" → cron: "57 8 <明天日期> <明天月份> *", recurring: false

## 定期任务（recurring: true，默认值）

适用于"每 N 分钟"/"每小时"/"工作日早上 9 点"的请求：
  "*/5 * * * *"（每 5 分钟）、"0 * * * *"（每小时）、"0 9 * * 1-5"（工作日本地时间早上 9 点）

## 在任务允许时避免使用整点和半点分钟

每个要求"9 点"的用户都会得到 \`0 9\`，每个要求"每小时"的用户都会得到 \`0 *\`——这意味着来自全球的请求会在同一时刻到达 API。当用户的请求是大约某个时间时，选择不是 0 或 30 的分钟：
  "每天早上大约 9 点" → "57 8 * * *" 或 "3 9 * * *"（不要用 "0 9 * * *"）
  "每小时" → "7 * * * *"（不要用 "0 * * * *"）
  "大概一小时后提醒我..." → 选择你定下来的任何分钟，不要取整

仅当用户明确指定该时间且明确意味着整点时才使用分钟 0 或 30（"9:00 整"、"半点整"、配合会议时间）。有疑问时，提前或推迟几分钟——用户不会注意到，而服务器集群会受益。

${durabilitySection}

## 运行时行为

任务仅在 REPL 空闲时（不在处理查询期间）触发。${durableRuntimeNote}调度器会在你选择的时间基础上添加少量确定性抖动：定期任务最多延迟其周期的 10%（最多 15 分钟）触发；落在整点或半点的单次任务提前最多 90 秒触发。选择非整点分钟仍是更大的杠杆。

定期任务在 ${DEFAULT_MAX_AGE_DAYS} 天后自动到期——触发最后一次后删除。这限制了会话生命周期。安排定期任务时请告知用户 ${DEFAULT_MAX_AGE_DAYS} 天的限制。

返回一个任务 ID，可传入 ${CRON_DELETE_TOOL_NAME}。`
}

export const CRON_DELETE_DESCRIPTION = '通过 ID 取消已计划的 cron 任务'
export function buildCronDeletePrompt(durableEnabled: boolean): string {
  return durableEnabled
    ? `取消之前通过 ${CRON_CREATE_TOOL_NAME} 计划的 cron 任务。从 .claude/scheduled_tasks.json（持久性任务）或内存会话存储（仅会话任务）中删除。`
    : `取消之前通过 ${CRON_CREATE_TOOL_NAME} 计划的 cron 任务。从内存会话存储中删除。`
}

export const CRON_LIST_DESCRIPTION = '列出已计划的 cron 任务'
export function buildCronListPrompt(durableEnabled: boolean): string {
  return durableEnabled
    ? `列出所有通过 ${CRON_CREATE_TOOL_NAME} 计划的 cron 任务，包括持久性任务（.claude/scheduled_tasks.json）和仅会话任务。`
    : `列出本次会话中所有通过 ${CRON_CREATE_TOOL_NAME} 计划的 cron 任务。`
}
