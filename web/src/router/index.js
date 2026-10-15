import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  { path: '/login', name: 'Login', component: () => import('@/views/Login.vue') },
  { path: '/', name: 'Home', component: () => import('@/views/Home.vue'), meta: { auth: true } },
  { path: '/product/:id', name: 'ProductDetail', component: () => import('@/views/ProductDetail.vue'), meta: { auth: true } },
  { path: '/publish', name: 'Publish', component: () => import('@/views/Publish.vue'), meta: { auth: true } },
  { path: '/cart', name: 'Cart', component: () => import('@/views/Cart.vue'), meta: { auth: true } },
  { path: '/orders', name: 'Orders', component: () => import('@/views/Orders.vue'), meta: { auth: true } },
  { path: '/profile', name: 'Profile', component: () => import('@/views/Profile.vue'), meta: { auth: true } }
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
})

export default router