import { Op } from 'sequelize'
import { Conversation, ChatMessage, User, Product } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function startConversation(req, res, next) {
  try {
    const { sellerId, productId } = req.body
    const buyerId = req.user.id

    if (!sellerId) return fail(res, '请指定对方用户')
    if (sellerId === buyerId) return fail(res, '不能和自己对话')

    let conv = await Conversation.findOne({
      where: {
        [Op.or]: [
          { buyerId, sellerId },
          { buyerId: sellerId, sellerId: buyerId }
        ]
      },
      order: [['last_message_at', 'DESC']]
    })

    if (conv) {
      if (productId && conv.productId !== productId) {
        await conv.update({ productId })
      }
    } else {
      conv = await Conversation.create({
        buyerId, sellerId, productId: productId || null,
        lastMessageAt: new Date()
      })
      await ChatMessage.create({
        conversationId: conv.id,
        senderId: buyerId,
        content: '你好，我要购买你的书，我们可以聊聊吗'
      })
    }

    success(res, { conversationId: conv.id }, '对话已创建')
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

    const result = []
    for (const c of convs) {
      const lastMsg = await ChatMessage.findOne({
        where: { conversationId: c.id },
        order: [['created_at', 'DESC']]
      })
      const unreadCount = await ChatMessage.count({
        where: { conversationId: c.id, senderId: { [Op.ne]: userId }, isRead: false }
      })
      result.push({
        id: c.id,
        buyer: c.buyer,
        seller: c.seller,
        product: c.product,
        lastMessage: lastMsg?.content || '',
        lastMessageAt: c.lastMessageAt,
        unreadCount
      })
    }

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