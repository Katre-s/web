import { sequelize } from '../config/database.js'
import { CartItem, Product, Order, OrderItem, User } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 事务锁等待/死锁自动重试：线上偶发并发时避免直接 500
async function withRetry(fn, tries = 3, baseDelay = 1000) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn()
    } catch (err) {
      const msg = String(err?.message || err)
      const retryable = msg.includes('Lock wait timeout') || msg.includes('Deadlock') || msg.includes('deadlock')
      if (retryable && i < tries) {
        await new Promise((r) => setTimeout(r, baseDelay * i))
        continue
      }
      throw err
    }
  }
}

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

    // 余额校验：买家余额必须足够支付
    const buyer = await User.findByPk(req.user.id)
    const buyerBalance = Number(buyer.balance)
    if (buyerBalance < totalPrice) {
      return fail(res, `余额不足，当前余额 ¥${buyerBalance.toFixed(2)}，本单需 ¥${totalPrice.toFixed(2)}`)
    }

    // 按卖家汇总本单应收金额
    const sellerGain = new Map()
    availableItems.forEach((i) => {
      const sellerId = i.product.userId
      sellerGain.set(sellerId, (sellerGain.get(sellerId) || 0) + Number(i.product.price))
    })

    // 事务：扣买家余额 → 卖家入账 → 商品标记售出 → 建订单 → 明细
    // 顺序关键：必须先 Product.update（拿商品行 X 锁），再建明细（外键检查只取 S 锁，自己持有 X 兼容），
    // 反之则明细插入时 FK 检查对商品行加 S 锁（事务结束才释放），同事务再 UPDATE 需 X 锁 → MySQL5.7 Lock wait timeout
    const order = await withRetry(() => sequelize.transaction(async (tx) => {
      await User.update(
        { balance: sequelize.literal(`balance - ${totalPrice}`) },
        { where: { id: req.user.id }, transaction: tx }
      )
      for (const [sellerId, gain] of sellerGain) {
        await User.update(
          { balance: sequelize.literal(`balance + ${gain}`) },
          { where: { id: sellerId }, transaction: tx }
        )
      }

      await Product.update({ status: 'sold' }, { where: { id: availableItems.map(i => i.productId) } }, { transaction: tx })

      const newOrder = await Order.create({ buyerId: req.user.id, totalPrice, status: 'pending' }, { transaction: tx })
      await OrderItem.bulkCreate(availableItems.map(i => ({
        orderId: newOrder.id,
        productId: i.productId,
        sellerId: i.product.userId,
        price: i.product.price
      })), { transaction: tx })

      await CartItem.destroy({ where: { id: cartItemIds } }, { transaction: tx })
      return newOrder
    }))

    success(res, order, '下单成功，已从余额中扣款')
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

    // 取消订单 → 原路退款（买家加回，卖家扣回）；已完成/确认收货不产生金额变动
    if (status === 'cancelled' && order.status !== 'cancelled') {
      const items = await OrderItem.findAll({ where: { orderId: order.id } })
      const sellerRefund = new Map()
      items.forEach((it) => {
        sellerRefund.set(it.sellerId, (sellerRefund.get(it.sellerId) || 0) + Number(it.price))
      })

      await withRetry(() => sequelize.transaction(async (tx) => {
        // 先恢复商品为可售（拿商品行 X 锁，与明细外键无冲突）
        await Product.update(
          { status: 'available' },
          { where: { id: items.map(it => it.productId) } },
          { transaction: tx }
        )
        await User.update(
          { balance: sequelize.literal(`balance + ${Number(order.totalPrice)}`) },
          { where: { id: order.buyerId }, transaction: tx }
        )
        for (const [sellerId, refund] of sellerRefund) {
          await User.update(
            { balance: sequelize.literal(`balance - ${refund}`) },
            { where: { id: sellerId }, transaction: tx }
          )
        }
        order.status = 'cancelled'
        await order.save({ transaction: tx })
      }))
      success(res, order, '订单已取消，款项已原路退回')
      return
    }

    order.status = status
    await order.save()
    success(res, order, '状态更新成功')
  } catch (err) { next(err) }
}
