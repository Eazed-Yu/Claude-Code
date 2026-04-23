import { TICK_TAG } from '../../constants/xml.js'

export const SLEEP_TOOL_NAME = 'Sleep'

export const DESCRIPTION = '等待指定时长'

export const SLEEP_TOOL_PROMPT = `等待指定时长。用户随时可以中断休眠。

当用户让你休眠或暂停时、当你无事可做时，或当你在等待某件事情时，请使用此工具。

你可能会收到 <${TICK_TAG}> 提示——这些是定期的存活检查。在休眠前先寻找有用的工作。

你可以与其他工具并发调用此工具——它不会干扰其他工具。

优先使用此工具而非 \`Bash(sleep ...)\`——它不会占用 shell 进程。

每次唤醒都需要一次 API 调用，但提示缓存在闲置 5 分钟后会过期——请权衡后决定。`
