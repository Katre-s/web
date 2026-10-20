import { CartItem, Product, Order, OrderItem } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function create(req, res, next) {
  try {
    const { cartItemIds } = req.body
    if (!cartItemIds || !cartItemIds.length) return fail(res, '请选择要下单的商品')

    const cartItems = await CartItem.findAll({
      where: { id: cartItemIds, userId: req.user.id },
      include: [{ model: Product, as: 'product' }]
    })
    if (!cartItems.length) return fail(res, '购物车商品不存在')

    const availableItems = cartItems.filter(i => i.product && i.product.status === 'available')
    if (!availableItems.length) return fail(res, '所选商品已售出')

    const totalPrice = availableItems.reduce((sum, i) => sum + Number(i.product.price), 0)
    const order = await Order.create({ buyerId: req.user.id, totalPrice, status: 'pending' })

    await OrderItem.bulkCreate(availableItems.map(i => ({
      orderId: order.id,
      productId: i.productId,
      sellerId: i.product.userId,
      price: i.product.price
    })))

    await Product.update({ status: 'sold' }, { where: { id: availableItems.map(i => i.productId) } })
    await CartItem.destroy({ where: { id: cartItemIds } })

    success(res, order, '下单成功')
  } catch (err) { next(err) }
}

export async function list(req, res, next) {
  try {
    const { role } = req.query
    let orders
    if (role === 'seller') {
      orders = await Order.findAll({
        include: [{
          model: OrderItem, as: 'items',
          where: { sellerId: req.user.id },
          include: [{ model: Product, as: 'product' }]
        }],
        order: [['created_at', 'DESC']]
      })
    } else {
      orders = await Order.findAll({
        where: { buyerId: req.user.id },
        include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }],
        order: [['created_at', 'DESC']]
      })
    }
    success(res, orders)
  } catch (err) { next(err) }
}

export async function updateStatus(req, res, next) {
  try {
    const { status } = req.body
    const validStatus = ['pending', 'confirmed', 'completed', 'cancelled']
    if (!validStatus.includes(status)) return fail(res, '无效的订单状态')

    const order = await Order.findByPk(req.params.id)
    if (!order) return fail(res, '订单不存在', 404)

    // 只有买家本人、订单内卖家或管理员可以改状态
    if (req.user.role !== 'admin' && order.buyerId !== req.user.id) {
      const asSeller = await OrderItem.findOne({ where: { orderId: order.id, sellerId: req.user.id } })
      if (!asSeller) return fail(res, '无权操作该订单', 403)
    }

    order.status = status
    await order.save()
    success(res, order, '状态更新成功')
  } catch (err) { next(err) }
}