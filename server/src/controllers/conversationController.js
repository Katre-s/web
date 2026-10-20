import { Op } from 'sequelize'
import { sequelize, Conversation, ChatMessage, User, Product } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function startConversation(req, res, next) {
  try {
    const buyerId = req.user.id
    const sellerId = Number(req.body.sellerId)
    const productIdRaw = req.body.productId
    const productId = productIdRaw === null || productIdRaw === undefined || productIdRaw === ''
      ? null
      : Number(productIdRaw)

    if (!Number.isInteger(sellerId) || sellerId <= 0) return fail(res, '请指定对方用户')
    if (sellerId === buyerId) return fail(res, '不能和自己对话')
    if (productId !== null && (!Number.isInteger(productId) || productId <= 0)) {
      return fail(res, '商品参数不合法')
    }

    // 先校验对方用户存在，避免外键约束报 500（用户注销/脏 id 时前端只会看到"创建对话失败"）
    const seller = await User.findByPk(sellerId, { attributes: ['id', 'nickname'] })
    if (!seller) return fail(res, '对方用户不存在', 404)

    let conv = await Conversation.findOne({
      where: {
        [Op.or]: [
          { buyerId, sellerId },
          { buyerId: sellerId, sellerId: buyerId }
        ]
      },
      order: [['last_message_at', 'DESC']]
    })

    let isNew = false
    if (conv) {
      // 同一对用户只保留一个会话；换了商品就更新关联商品，保证聊天页顶部展示的是当前这本书
      if (productId && conv.productId !== productId) {
        await conv.update({ productId })
      }
    } else {
      conv = await Conversation.create({
        buyerId, sellerId, productId,
        lastMessageAt: new Date()
      })
      await ChatMessage.create({
        conversationId: conv.id,
        senderId: buyerId,
        content: '你好，我要购买你的书，我们可以聊聊吗'
      })
      isNew = true
    }

    // 统一返回 conversationId，前端据此跳到「对话」并自动打开这个对话框
    success(res, { conversationId: conv.id, isNew, seller: { id: seller.id, nickname: seller.nickname } }, isNew ? '对话已创建' : '对话已存在')
  } catch (err) { next(err) }
}

export async function listConversations(req, res, next) {
  try {
    const userId = req.user.id
    const convs = await Conversation.findAll({
      where: {
        [Op.or]: [{ buyerId: userId }, { sellerId: userId }]
      },
      order: [['last_message_at', 'DESC']],
      include: [
        { model: User, as: 'buyer', attributes: ['id', 'nickname', 'avatar'] },
        { model: User, as: 'seller', attributes: ['id', 'nickname', 'avatar'] },
        { model: Product, as: 'product', attributes: ['id', 'bookTitle', 'bookCover', 'title'] }
      ]
    })
    if (!convs.length) return success(res, [])

    const convIds = convs.map(c => c.id)

    // 批量取每个对话的最后一条消息(按最大 id)与未读数，避免逐个对话查询(N+1)
    const [lastIdRows, unreadRows] = await Promise.all([
      ChatMessage.findAll({
        attributes: ['conversationId', [sequelize.fn('MAX', sequelize.col('id')), 'maxId']],
        where: { conversationId: convIds },
        group: ['conversationId'],
        raw: true
      }),
      ChatMessage.findAll({
        attributes: ['conversationId', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
        where: { conversationId: convIds, senderId: { [Op.ne]: userId }, isRead: false },
        group: ['conversationId'],
        raw: true
      })
    ])

    const lastMsgIdMap = new Map(lastIdRows.map(r => [r.conversationId, r.maxId]))
    const unreadMap = new Map(unreadRows.map(r => [r.conversationId, Number(r.cnt)]))

    const lastMsgIds = [...lastMsgIdMap.values()]
    const lastMsgMap = new Map()
    if (lastMsgIds.length) {
      const msgs = await ChatMessage.findAll({
        where: { id: lastMsgIds },
        attributes: ['id', 'conversationId', 'content']
      })
      for (const m of msgs) lastMsgMap.set(m.conversationId, m)
    }

    const result = convs.map(c => ({
      id: c.id,
      buyer: c.buyer,
      seller: c.seller,
      product: c.product,
      lastMessage: lastMsgMap.get(c.id)?.content || '',
      lastMessageAt: c.lastMessageAt,
      unreadCount: unreadMap.get(c.id) || 0
    }))

    success(res, result)
  } catch (err) { next(err) }
}

export async function getMessages(req, res, next) {
  try {
    const { id } = req.params
    const userId = req.user.id

    const conv = await Conversation.findByPk(id)
    if (!conv) return fail(res, '对话不存在', 404)
    if (conv.buyerId !== userId && conv.sellerId !== userId) {
      return fail(res, '无权访问', 403)
    }

    await ChatMessage.update(
      { isRead: true },
      { where: { conversationId: id, senderId: { [Op.ne]: userId } } }
    )

    const messages = await ChatMessage.findAll({
      where: { conversationId: id },
      order: [['created_at', 'ASC']],
      include: [{ model: User, as: 'sender', attributes: ['id', 'nickname', 'avatar'] }]
    })

    success(res, messages)
  } catch (err) { next(err) }
}

export async function sendMessage(req, res, next) {
  try {
    const { id } = req.params
    const { content } = req.body
    const userId = req.user.id

    if (!content) return fail(res, '请输入消息内容')

    const conv = await Conversation.findByPk(id)
    if (!conv) return fail(res, '对话不存在', 404)
    if (conv.buyerId !== userId && conv.sellerId !== userId) {
      return fail(res, '无权访问', 403)
    }

    const msg = await ChatMessage.create({
      conversationId: id,
      senderId: userId,
      content
    })
    await conv.update({ lastMessageAt: new Date() })

    success(res, msg, '发送成功')
  } catch (err) { next(err) }
}