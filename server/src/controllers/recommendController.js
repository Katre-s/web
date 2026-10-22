import { getRecommendations, recordBehavior } from '../services/recommendService.js'
import { success, fail } from '../utils/response.js'

/** 首页推荐（登录用户） */
export async function home(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20)
    const data = await getRecommendations(req.user.id, limit)
    success(res, data)
  } catch (err) { next(err) }
}

/** 上报搜索 / 点击行为 */
export async function track(req, res, next) {
  try {
    const { type, keyword, category, productId } = req.body || {}
    if (!['search', 'click'].includes(type)) return fail(res, '无效的行为类型')
    await recordBehavior(req.user.id, { type, keyword, category, productId })
    success(res, null, 'ok')
  } catch (err) { next(err) }
}
