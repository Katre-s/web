import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { openAuthDialog, visible as authDialogVisible } from '@/stores/authDialog'
import { ElMessage } from 'element-plus/es/components/message/index'

const routes = [
  // 登录已改成弹窗：旧的 /login 链接统一回首页，避免收藏夹里的老地址打不开
  { path: '/login', redirect: '/' },
  // 忘记密码是独立流程页，未登录也能进
  { path: '/forgot-password', name: 'ForgotPassword', component: () => import('@/views/ForgotPassword.vue'), meta: { public: true } },
  // 首页也要登录：未登录进首页会弹登录窗（电脑端、手机端一致）
  { path: '/', name: 'Home', component: () => import('@/views/Home.vue'), meta: { auth: true } },
  { path: '/trade', name: 'Trade', component: () => import('@/views/Trade.vue'), meta: { auth: true } },
  { path: '/plaza', name: 'Plaza', component: () => import('@/views/Plaza.vue'), meta: { auth: true } },
  { path: '/book/:key', name: 'BookDetail', component: () => import('@/views/BookDetail.vue'), meta: { auth: true } },
  { path: '/chat', name: 'Chat', component: () => import('@/views/Chat.vue'), meta: { auth: true } },
  { path: '/ai-chat', name: 'AiChat', component: () => import('@/views/AiChat.vue'), meta: { auth: true } },
  { path: '/product/:id', name: 'ProductDetail', component: () => import('@/views/ProductDetail.vue'), meta: { auth: true } },
  { path: '/publish', name: 'Publish', component: () => import('@/views/Publish.vue'), meta: { auth: true } },
  { path: '/cart', redirect: () => ({ path: '/orders', query: { tab: 'cart' } }) },
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

  // 未登录：除了忘记密码，其余（含首页）一律弹登录窗。
  // 目标路径记下来，登录成功后由 AuthDialog 自动送回去。
  const isPublic = to.meta.public === true
  if (!isPublic && !userStore.isLoggedIn) {
    // 重复进入（例如从 /trade 跳回首页再次触发守卫）时不再弹，避免把 redirect 覆盖掉
    if (!authDialogVisible.value) {
      openAuthDialog('login', to.fullPath)
    }
    // 首页允许继续渲染（被登录窗遮住），其他页面跳回首页再弹
    return to.name === 'Home' ? true : { name: 'Home' }
  }

  if (to.meta.admin && userStore.userInfo?.role !== 'admin') {
    ElMessage.warning('无管理员权限')
    return { name: 'Home' }
  }
})

export default router
