import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'

const routes = [
  { path: '/login', name: 'Login', component: () => import('@/views/Login.vue') },
  { path: '/', name: 'Home', component: () => import('@/views/Home.vue'), meta: { auth: true } },
  { path: '/trade', name: 'Trade', component: () => import('@/views/Trade.vue'), meta: { auth: true } },
  { path: '/book/:key', name: 'BookDetail', component: () => import('@/views/BookDetail.vue'), meta: { auth: true } },
  { path: '/chat', name: 'Chat', component: () => import('@/views/Chat.vue'), meta: { auth: true } },
  { path: '/product/:id', name: 'ProductDetail', component: () => import('@/views/ProductDetail.vue'), meta: { auth: true } },
  { path: '/publish', name: 'Publish', component: () => import('@/views/Publish.vue'), meta: { auth: true } },
  { path: '/cart', name: 'Cart', component: () => import('@/views/Cart.vue'), meta: { auth: true } },
  { path: '/booklist', name: 'BookListUpload', component: () => import('@/views/BookListUpload.vue'), meta: { auth: true } },
  { path: '/orders', name: 'Orders', component: () => import('@/views/Orders.vue'), meta: { auth: true } },
  { path: '/profile', name: 'Profile', component: () => import('@/views/Profile.vue'), meta: { auth: true } },
  { path: '/admin', name: 'Admin', component: () => import('@/views/Admin.vue'), meta: { auth: true, admin: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const userStore = useUserStore()
  if (to.meta.auth && !userStore.isLoggedIn) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  if (to.meta.admin && userStore.userInfo?.role !== 'admin') {
    ElMessage.warning('无管理员权限')
    return { name: 'Home' }
  }
})

export default router