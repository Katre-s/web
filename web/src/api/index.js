import request from './request'

export const authApi = {
  login: (email, password) => request.post('/auth/login', { email, password }),
  register: (nickname, realName, email, code, password) => request.post('/auth/register', { nickname, realName, email, code, password }),
  sendCode: (email) => request.post('/auth/send-code', { email })
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
  parseList: (formData) => request.post('/book/parse-list', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  match: (bookList) => request.post('/book/match', { bookList })
}

export const cartApi = {
  list: () => request.get('/cart'),
  add: (productId) => request.post('/cart/add', { productId }),
  batchAdd: (productIds) => request.post('/cart/batch-add', { productIds }),
  remove: (productId) => request.delete(`/cart/remove/${productId}`)
}

export const orderApi = {
  create: (cartItemIds) => request.post('/orders/create', { cartItemIds }),
  list: (role) => request.get('/orders', { params: { role } }),
  updateStatus: (id, status) => request.patch(`/orders/${id}/status`, { status })
}

export const wishlistApi = {
  add: (data) => request.post('/wishlist/add', data),
  list: () => request.get('/wishlist')
}

export const favoriteApi = {
  toggle: (productId) => request.post('/favorites/toggle', { productId }),
  list: () => request.get('/favorites')
}

export const messageApi = {
  send: (productId, receiverId, content) => request.post('/messages', { productId, receiverId, content }),
  list: () => request.get('/messages')
}