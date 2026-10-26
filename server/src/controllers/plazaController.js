import { Op } from 'sequelize'
import { sequelize } from '../config/database.js'
import { PlazaPost, PlazaReply, User } from '../models/index.js'
import { success, fail } from '../utils/response.js'

const AUTHOR_ATTRS = ['id', 'nickname', 'avatar', 'campus', 'userNo']

function serialize(post) {
  const json = post && post.toJSON ? post.toJSON() : (post || {})
  let images = []
  try {
    const parsed = JSON.parse(json.images || '[]')
    if (Array.isArray(parsed)) images = parsed.filter(Boolean)
  } catch {
    images = []
  }
  return { ...json, images }
}

function serializeReply(reply) {
  const json = reply && reply.toJSON ? reply.toJSON() : (reply || {})
  return {
    id: json.id,
    postId: json.postId,
    userId: json.userId,
    content: json.content,
    createdAt: json.createdAt,
    author: json.author
  }
}

/**
 * 批量补回复数。用一次 GROUP BY 查完，避免每条帖子单独查一次。
 * 回复数只算 active 的，被删掉的回复不该计入。
 */
async function attachReplyCounts(posts) {
  if (!posts || !posts.length) return posts
  const ids = posts.map(p => p.id)
  // 列名直接写数据库字段（post_id），不依赖 ORM 的属性→列名映射
  const rows = await PlazaReply.findAll({
    attributes: [
      [sequelize.col('post_id'), 'postId'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'n']
    ],
    where: { postId: { [Op.in]: ids }, status: 'active' },
    group: [sequelize.col('post_id')],
    raw: true
  })
  const map = new Map(rows.map(r => [Number(r.postId ?? r.post_id), Number(r.n) || 0]))
  return posts.map(p => ({ ...p, replyCount: map.get(Number(p.id)) || 0 }))
}

/** 前台广场列表：只返回正常状态，按时间倒序 */
export async function list(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1)
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 10, 1), 30)
    const { rows, count } = await PlazaPost.findAndCountAll({
      where: { status: 'active' },
      include: [{ model: User, as: 'author', attributes: AUTHOR_ATTRS }],
      order: [['created_at', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    })
    const posts = await attachReplyCounts(rows.map(serialize))
    success(res, { list: posts, total: count, page, pageSize })
  } catch (err) { next(err) }
}

/** 我发布的帖子（个人中心「我的帖子」）：隐藏的也返回，自己能看到 */
export async function myList(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1)
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 10, 1), 30)
    const { rows, count } = await PlazaPost.findAndCountAll({
      where: { userId: req.user.id },
      include: [{ model: User, as: 'author', attributes: AUTHOR_ATTRS }],
      order: [['created_at', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    })
    const posts = await attachReplyCounts(rows.map(serialize))
    success(res, { list: posts, total: count, page, pageSize })
  } catch (err) { next(err) }
}

/** 发布动态：文字 + 最多 6 张图 */
export async function create(req, res, next) {
  try {
    const content = String(req.body.content || '').trim()
    const images = (req.files || []).map(f => `/uploads/${f.filename}`)

    if (!content && !images.length) return fail(res, '写点内容或上传图片吧')
    if (content.length > 500) return fail(res, '内容最多 500 字')
    if (images.length > 6) return fail(res, '最多上传 6 张图片')

    const post = await PlazaPost.create({
      userId: req.user.id,
      content,
      images: JSON.stringify(images),
      status: 'active'
    })
    const full = await PlazaPost.findByPk(post.id, {
      include: [{ model: User, as: 'author', attributes: AUTHOR_ATTRS }]
    })
    success(res, serialize(full), '发布成功')
  } catch (err) { next(err) }
}

/** 删除动态：作者本人或管理员 */
export async function remove(req, res, next) {
  try {
    const post = await PlazaPost.findByPk(req.params.id)
    if (!post) return fail(res, '动态不存在', 404)
    if (post.userId !== req.user.id && req.user.role !== 'admin') return fail(res, '无权删除', 403)
    // 老表是在没有外键约束时建的，CASCADE 不一定生效，这里显式清掉回复
    await PlazaReply.destroy({ where: { postId: post.id } })
    await post.destroy()
    success(res, null, '已删除')
  } catch (err) { next(err) }
}

/* ------------------------------ 帖子回复 ------------------------------ */

/** 某条帖子的回复列表（按时间正序，先看早的） */
export async function replyList(req, res, next) {
  try {
    const postId = Number(req.params.id)
    if (!postId) return fail(res, '帖子不存在', 404)
    const rows = await PlazaReply.findAll({
      where: { postId, status: 'active' },
      include: [{ model: User, as: 'author', attributes: AUTHOR_ATTRS }],
      order: [['created_at', 'ASC']],
      limit: 200
    })
    success(res, rows.map(serializeReply))
  } catch (err) { next(err) }
}

/** 回复帖子 */
export async function replyCreate(req, res, next) {
  try {
    const postId = Number(req.params.id)
    const content = String(req.body.content || '').trim()
    if (!content) return fail(res, '回复内容不能为空')
    if (content.length > 300) return fail(res, '回复最多 300 字')

    const post = await PlazaPost.findByPk(postId)
    if (!post || post.status !== 'active') return fail(res, '帖子不存在或已被隐藏', 404)

    const reply = await PlazaReply.create({ postId, userId: req.user.id, content, status: 'active' })
    const full = await PlazaReply.findByPk(reply.id, {
      include: [{ model: User, as: 'author', attributes: AUTHOR_ATTRS }]
    })
    success(res, serializeReply(full), '回复成功')
  } catch (err) { next(err) }
}

/** 删除回复：回复本人、楼主或管理员 */
export async function replyRemove(req, res, next) {
  try {
    const reply = await PlazaReply.findByPk(req.params.id)
    if (!reply) return fail(res, '回复不存在', 404)
    const post = await PlazaPost.findByPk(reply.postId)
    const isOwner = reply.userId === req.user.id
    const isPostAuthor = post && post.userId === req.user.id
    if (!isOwner && !isPostAuthor && req.user.role !== 'admin') return fail(res, '无权删除', 403)
    await reply.destroy()
    success(res, null, '已删除')
  } catch (err) { next(err) }
}

/* ------------------------------ 后台管理 ------------------------------ */

export async function adminList(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1)
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100)
    const { keyword = '', status = '' } = req.query
    const where = {}
    if (status) where.status = status
    if (keyword) where.content = { [Op.like]: `%${keyword}%` }

    const { rows, count } = await PlazaPost.findAndCountAll({
      where,
      include: [{ model: User, as: 'author', attributes: [...AUTHOR_ATTRS, 'email'] }],
      order: [['created_at', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    })
    success(res, { list: rows.map(serialize), total: count })
  } catch (err) { next(err) }
}

export async function adminUpdate(req, res, next) {
  try {
    const { status } = req.body
    if (!['active', 'hidden'].includes(status)) return fail(res, '无效的状态')
    const post = await PlazaPost.findByPk(req.params.id)
    if (!post) return fail(res, '动态不存在', 404)
    await post.update({ status })
    success(res, serialize(post), status === 'hidden' ? '已隐藏' : '已恢复展示')
  } catch (err) { next(err) }
}

export async function adminRemove(req, res, next) {
  try {
    const post = await PlazaPost.findByPk(req.params.id)
    if (!post) return fail(res, '动态不存在', 404)
    await post.destroy()
    success(res, null, '已删除')
  } catch (err) { next(err) }
}
