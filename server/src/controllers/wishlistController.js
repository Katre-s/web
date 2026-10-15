import { Wishlist } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function add(req, res, next) {
  try {
    const { title, author, isbn } = req.body
    if (!title && !isbn) return fail(res, '请填写书名或ISBN')

    const item = await Wishlist.create({ userId: req.user.id, title, author, isbn })
    success(res, item, '已加入求购清单')
  } catch (err) { next(err) }
}

export async function list(req, res, next) {
  try {
    const items = await Wishlist.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']]
    })
    success(res, items)
  } catch (err) { next(err) }
}