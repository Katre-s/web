export function success(res, data = null, message = '操作成功') {
  return res.json({ code: 0, message, data })
}

export function fail(res, message = '操作失败', code = 400) {
  return res.status(code).json({ code, message })
}

export function paginate(res, rows, count, page, pageSize) {
  return res.json({
    code: 0,
    data: rows,
    total: count,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(count / pageSize)
  })
}