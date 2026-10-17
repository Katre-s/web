import { CartItem, Product, User } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function list(req, res, next) {
  try {
    const items = await CartItem.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Product, as: 'product',
        include: [{ model: User, as: 'seller', attributes: ['id', 'userNo', 'nickname', 'avatar', 'campus'] }]
      }],
      order: [['created_at', 'DESC']]
    })
    success(res, items)
  } catch (err) { next(err) }
}

export async function add(req, res, next) {
  try {
    const { productId } = req.body
    const exists = await CartItem.findOne({ where: { userId: req.user.id, productId } })
    if (exists) return success(res, null, '已在购物车中')

    await CartItem.create({ userId: req.user.id, productId })
    success(res, null, '已加入购物车')
  } catch (err) { next(err) }
}

export async function batchAdd(req, res, next) {
  try {
    const { productIds } = req.body
    if (!productIds || !productIds.length) return fail(res, '请选择商品')

    const existing = await CartItem.findAll({
      where: { userId: req.user.id, productId: productIds }
    })
    const existingIds = existing.map(e => e.productId)
    const newIds = productIds.filter(id => !existingIds.includes(id))

    if (newIds.length) {
      await CartItem.bulkCreate(newIds.map(productId => ({ userId: req.user.id, productId })))
    }
    success(res, null, `已加入${newIds.length}件商品`)
  } catch (err) { next(err) }
}

export async function remove(req, res, next) {
  try {
    await CartItem.destroy({ where: { userId: req.user.id, productId: req.params.productId } })
    success(res, null, '已移除')
  } catch (err) { next(err) }
}