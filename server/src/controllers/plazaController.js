import { Op } from 'sequelize'
import { PlazaPost, User } from '../models/index.js'
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
    success(res, { list: rows.map(serialize), total: count, page, pageSize })
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
    await post.destroy()
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
