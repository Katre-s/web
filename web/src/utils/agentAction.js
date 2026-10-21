/**
 * AI 消息里的"可执行动作"在前端的落地逻辑
 * ------------------------------------------------------------------
 * 后端已经在 agentTools.js 里完成了真正的写操作（购物车/求购/商品），
 * 前端这里只负责：
 *   1) 打开页面（navigate）
 *   2) 带上草稿打开发布页 / 求购上架弹窗（open_publish / open_wish）
 * 草稿走 sessionStorage，避免把参数塞进 URL 影响分享和刷新。
 */

export const DRAFT_KEYS = {
  publish: 'ai_publish_draft',
  wish: 'ai_wish_draft'
}

export function saveDraft(key, draft) {
  try {
    sessionStorage.setItem(key, JSON.stringify(draft || {}))
  } catch {}
}

export function takeDraft(key) {
  try {
    const raw = sessionStorage.getItem(key)
    sessionStorage.removeItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * @param {object} action  { type, path?, label?, draft? }
 * @param {import('vue-router').Router} router
 * @param {{before?: Function}} opts
 */
export function runAgentAction(action, router, opts = {}) {
  if (!action || !action.type) return false
  opts.before?.()

  if (action.type === 'open_publish') {
    saveDraft(DRAFT_KEYS.publish, action.draft)
    router.push({ path: '/publish', query: { from: 'ai' } })
    // 已经在发布页时路由不会重新挂载，靠事件直接唤醒
    window.dispatchEvent(new CustomEvent('ai-action', { detail: action }))
    return true
  }

  if (action.type === 'open_wish') {
    saveDraft(DRAFT_KEYS.wish, action.draft)
    router.push({ path: '/trade', query: { tab: 'buy', compose: 'wish' } })
    window.dispatchEvent(new CustomEvent('ai-action', { detail: action }))
    return true
  }

  if (action.path) {
    router.push(action.path)
    return true
  }

  return false
}
