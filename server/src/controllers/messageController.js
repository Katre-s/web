import { Message, Notification } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export async function send(req, res, next) {
  try {
    const { productId, receiverId, content } = req.body
    if (!receiverId || !content) return fail(res, '请填写接收者和内容')
    if (receiverId === req.user.id) return fail(res, '不能给自己发消息')

    const msg = await Message.create({
      productId, senderId: req.user.id, receiverId, content
    })
    await Notification.create({
      userId: receiverId, type: 'message',
      content: `您有一条新消息：${content.substring(0, 50)}`
    })
    success(res, msg, '发送成功')
  } catch (err) { next(err) }
}

export async function list(req, res, next) {
  try {
    const messages = await Message.findAll({
      where: { receiverId: req.user.id },
      order: [['created_at', 'DESC']]
    })
    success(res, messages)
  } catch (err) { next(err) }
}