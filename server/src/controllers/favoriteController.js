import { Favorite, Product } from '../models/index.js'
import { success } from '../utils/response.js'

export async function toggle(req, res, next) {
  try {
    const { productId } = req.body
    const exists = await Favorite.findOne({ where: { userId: req.user.id, productId } })
    if (exists) {
      await exists.destroy()
      success(res, { favorited: false }, '已取消收藏')
    } else {
      await Favorite.create({ userId: req.user.id, productId })
      success(res, { favorited: true }, '已收藏')
    }
  } catch (err) { next(err) }
}

export async function list(req, res, next) {
  try {
    const items = await Favorite.findAll({
      where: { userId: req.user.id },
      include: [{ model: Product, as: 'product' }],
      order: [['created_at', 'DESC']]
    })
    success(res, items)
  } catch (err) { next(err) }
}