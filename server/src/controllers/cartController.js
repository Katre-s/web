import { CartItem, Product, ProductImage, User } from '../models/index.js'
import { success, fail } from '../utils/response.js'

/** 只接受正整数 id，避免 undefined / null 落到 SQL 里变成非法参数（曾导致 500） */
function toPositiveInt(v) {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function list(req, res, next) {
  try {
    const items = await CartItem.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Product, as: 'product',
        required: false, // 商品被删时 product 为 null，用 LEFT JOIN 保证列表本身不报错
        include: [
          { model: User, as: 'seller', attributes: ['id', 'userNo', 'nickname', 'avatar', 'campus'] },
          { model: ProductImage, as: 'images' }
        ]
      }],
      order: [['created_at', 'DESC']]
    })

    // 商品被删除后会留下孤儿购物车条目(product 为 null)，会导致前端渲染崩溃
    // 这里过滤掉并顺手清理，避免"拉取购物车失败"
    const valid = items.filter(i => i.product)
    const orphanIds = items.filter(i => !i.product).map(i => i.id)
    if (orphanIds.length) {
      await CartItem.destroy({ where: { id: orphanIds } })
    }
    success(res, valid)
  } catch (err) { next(err) }
}

export async function add(req, res, next) {
  try {
    const productId = toPositiveInt(req.body.productId)
    if (!productId) return fail(res, '商品参数不合法')

    const product = await Product.findByPk(productId, { attributes: ['id', 'status', 'userId'] })
    if (!product) return fail(res, '商品不存在或已下架', 404)
    if (product.status && product.status !== 'available') return fail(res, '该商品已售出')

    const exists = await CartItem.findOne({ where: { userId: req.user.id, productId } })
    if (exists) return success(res, null, '已在购物车中')

    await CartItem.create({ userId: req.user.id, productId })
    success(res, null, '已加入购物车')
  } catch (err) { next(err) }
}

export async function batchAdd(req, res, next) {
  try {
    const raw = Array.isArray(req.body.productIds) ? req.body.productIds : []
    const productIds = [...new Set(raw.map(toPositiveInt).filter(Boolean))]
    if (!productIds.length) return fail(res, '请选择商品')

    // 只接受真实存在且在售的商品，避免写入脏数据
    const products = await Product.findAll({
      where: { id: productIds, status: 'available' },
      attributes: ['id']
    })
    const validIds = products.map(p => p.id)
    if (!validIds.length) return fail(res, '商品不存在或已下架')

    const existing = await CartItem.findAll({
      where: { userId: req.user.id, productId: validIds },
      attributes: ['productId']
    })
    const existingIds = new Set(existing.map(e => e.productId))
    const newIds = validIds.filter(id => !existingIds.has(id))

    if (newIds.length) {
      await CartItem.bulkCreate(newIds.map(productId => ({ userId: req.user.id, productId })))
    }
    success(res, null, `已加入${newIds.length}件商品`)
  } catch (err) { next(err) }
}

export async function remove(req, res, next) {
  try {
    const productId = toPositiveInt(req.params.productId)
    if (!productId) return fail(res, '商品参数不合法')
    await CartItem.destroy({ where: { userId: req.user.id, productId } })
    success(res, null, '已移除')
  } catch (err) { next(err) }
}
