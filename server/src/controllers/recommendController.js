import { getRecommendations, recordBehavior } from '../services/recommendService.js'
import { success, fail } from '../utils/response.js'

/** 首页推荐（登录用户）：全站在售商品铺开，按兴趣排序，一次性返回 */
export async function home(req, res, next) {
  try {
    // 上限 500：校园站商品量级远达不到，等于"全部返回"
    const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 500)
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
