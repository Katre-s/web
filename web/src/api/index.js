import request from './request'

export const authApi = {
  login: (email, password) => request.post('/auth/login', { email, password }),
  register: (nickname, realName, email, code, password, campus) => request.post('/auth/register', { nickname, realName, email, code, password, campus }),
  sendCode: (email) => request.post('/auth/send-code', { email }),
  sendResetCode: (email) => request.post('/auth/send-reset-code', { email }),
  resetPassword: (email, code, password) => request.post('/auth/reset-password', { email, code, password }),
  sendChangeEmailCode: (email) => request.post('/auth/send-change-email-code', { email }),
  changeEmail: (email, code) => request.post('/auth/change-email', { email, code }),
  me: () => request.get('/auth/me'),
  uploadAvatar: (formData) => request.post('/auth/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export const booksApi = {
  list: (params) => request.get('/books', { params }),
  detail: (key) => request.get(`/books/${encodeURIComponent(key)}`),
  homeStats: () => request.get('/books/home-stats')
}

export const productApi = {
  list: (params) => request.get('/products', { params }),
  detail: (id) => request.get(`/products/${id}`),
  create: (data) => request.post('/products', data),
  update: (id, data) => request.put(`/products/${id}`, data),
  delete: (id) => request.delete(`/products/${id}`),
  myProducts: () => request.get('/products/my')
}

export const bookApi = {
  isbnLookup: (isbn) => request.post('/book/isbn-lookup', { isbn }),
  scanBook: (formData) => request.post('/book/scan-book', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  parseList: (formData) => request.post('/book/parse-list', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  match: (bookList) => request.post('/book/match', { bookList }),
  processBookList: (isbns) => request.post('/book/process-booklist', { isbns })
}

export const bookFavoriteApi = {
  toggle: (bookId) => request.post('/book-favorites/toggle', { bookId }),
  list: () => request.get('/book-favorites'),
  check: (bookId) => request.get(`/book-favorites/check/${bookId}`)
}

export const cartApi = {
  list: () => request.get('/cart'),
  add: (productId) => request.post('/cart/add', { productId }),
  batchAdd: (productIds) => request.post('/cart/batch-add', { productIds }),
  remove: (productId) => request.delete(`/cart/remove/${productId}`)
}

export const orderApi = {
  create: (cartItemIds) => request.post('/orders/create', { cartItemIds }),
  list: (role, status) => request.get('/orders', { params: { role, status } }),
  updateStatus: (id, status) => request.patch(`/orders/${id}/status`, { status }),
  confirm: (id) => request.post(`/orders/${id}/confirm`),
  applyAftersale: (id, reason = '') => request.post(`/orders/${id}/aftersale`, { reason }),
  contactAdmin: (id) => request.post(`/orders/${id}/contact-admin`)
}

export const balanceApi = {
  recharge: (amount) => request.post('/balance/recharge', { amount }),
  logs: () => request.get('/balance/logs')
}

export const favoriteApi = {
  toggle: (productId) => request.post('/favorites/toggle', { productId }),
  list: () => request.get('/favorites'),
  check: (productId) => request.get(`/favorites/check/${productId}`)
}

export const messageApi = {
  send: (productId, receiverId, content) => request.post('/messages', { productId, receiverId, content }),
  list: () => request.get('/messages')
}
export const hotspotApi = {
  list: () => request.get('/hotspots'),
  create: (data) => request.post('/hotspots', data),
  adminList: () => request.get('/hotspots/admin/list'),
  remove: (id) => request.delete(`/hotspots/${id}`),
  move: (id, direction) => request.put(`/hotspots/${id}/sort`, { direction })
}

export const notificationApi = {
  myList: () => request.get('/notifications'),
  read: (id) => request.put(`/notifications/${id}/read`),
  readAll: () => request.put('/notifications/read-all'),
  broadcast: (content) => request.post('/notifications/admin/broadcast', { content }),
  sendToOne: (userId, content) => request.post('/notifications/admin/send', { userId, content })
}

export const adminApi = {
  stats: () => request.get('/admin/stats'),
  users: (params) => request.get('/admin/users', { params }),
  updateUser: (id, data) => request.put(`/admin/users/${id}`, data),
  updateUserNo: (id, userNo) => request.patch(`/admin/users/${id}/user-no`, { userNo }),
  createBook: (formData) => request.post('/admin/products', formData),
  deleteProduct: (id) => request.delete(`/admin/products/${id}`),
  listBoards: (params) => request.get('/admin/boards', { params }),
  updateBoard: (id, data) => request.put(`/admin/boards/${id}`, data),
  deleteBoard: (id) => request.delete(`/admin/boards/${id}`),
  updateBoardCover: (id, formData) => request.post(`/admin/boards/${id}/cover`, formData),
  listNotifications: () => request.get('/admin/notifications'),
  deleteNotification: (id) => request.delete(`/admin/notifications/${id}`),
  listItems: (params) => request.get('/admin/items', { params }),
  updateItem: (id, data) => request.put(`/admin/items/${id}`, data),
  deleteItem: (id) => request.delete(`/admin/items/${id}`),
  charts: () => request.get('/admin/charts'),
  listAfterSales: (params) => request.get('/admin/after-sales', { params }),
  handleAfterSale: (id, data) => request.put(`/admin/after-sales/${id}`, data),
  listPlaza: (params) => request.get('/admin/plaza', { params }),
  updatePlaza: (id, data) => request.put(`/admin/plaza/${id}`, data),
  deletePlaza: (id) => request.delete(`/admin/plaza/${id}`)
}

export const recommendApi = {
  home: (params) => request.get('/recommend/home', { params }),
  track: (data) => request.post('/recommend/event', data)
}

export const plazaApi = {
  list: (params) => request.get('/plaza', { params }),
  create: (formData) => request.post('/plaza', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (id) => request.delete(`/plaza/${id}`)
}

export const conversationApi = {
  start: (sellerId, productId) => request.post('/conversations/start', { sellerId, productId }),
  list: () => request.get('/conversations'),
  getMessages: (id) => request.get(`/conversations/${id}/messages`),
  sendMessage: (id, content) => request.post(`/conversations/${id}/messages`, { content })
}

export const agentApi = {
  chat: (message, history) => request.post('/agent/chat', { message, history })
}

export const weatherApi = {
  // 不传坐标时由服务端按 IP 定位；失败时前端静默保持默认视觉
  current: (params) => request.get('/weather', { params })
}