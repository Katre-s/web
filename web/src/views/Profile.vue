<template>
  <div class="profile-page">
    <h2 class="page-title">个人中心</h2>
    <div class="profile-card">
      <img :src="userStore.userInfo?.avatar || defaultAvatar" class="avatar" />
      <div class="profile-info">
        <h3>{{ userStore.userInfo?.nickname }}</h3>
        <p class="user-no">ID：{{ userStore.userInfo?.userNo || '未分配' }}</p>
        <p>邮箱：{{ userStore.userInfo?.email }} <el-button text type="primary" size="small" @click="showEmailDialog = true">更改</el-button></p>
      </div>
    </div>

    <el-tabs v-model="activeTab" @tab-change="loadTabData">
      <el-tab-pane label="我的发布" name="products" />
      <el-tab-pane label="板块收藏" name="favorites" />
      <el-tab-pane label="求购清单" name="wishlist" />
    </el-tabs>

    <div v-loading="loading">
      <div v-if="activeTab === 'products'" class="my-products">
        <div class="status-filter">
          <button class="filter-btn" :class="{ active: productFilter === 'available' }" @click="productFilter = 'available'">
            在售（{{ availableProducts.length }}）
          </button>
          <button class="filter-btn" :class="{ active: productFilter === 'sold' }" @click="productFilter = 'sold'">
            已售（{{ soldProducts.length }}）
          </button>
        </div>
        <div v-for="p in filteredProducts" :key="p.id" class="my-product-item">
          <div class="my-product-info" @click="goProduct(p)">
            <img :src="p.bookCover || p.images?.[0]?.imagePath || defaultAvatar" class="my-product-cover" />
            <div class="my-product-text">
              <div class="my-product-title">{{ p.bookTitle || p.title }}</div>
              <div class="my-product-meta">
                <span class="my-product-price">¥{{ p.price }}</span>
                <span class="my-product-status" :class="p.status === 'available' ? 'status-on' : 'status-off'">{{ p.status === 'available' ? '在售' : '已售' }}</span>
                <span v-if="p.status === 'sold' && p.buyer" class="buyer-name">买家：{{ p.buyer.nickname }}</span>
              </div>
            </div>
          </div>
          <div class="my-product-actions">
            <el-button v-if="p.status === 'sold' && p.buyer" type="primary" size="small" round @click="contactBuyer(p)">联系买家</el-button>
            <el-button type="danger" size="small" round @click="deleteProduct(p)">删除</el-button>
          </div>
        </div>
        <el-empty v-if="!filteredProducts.length" description="暂无书籍" />
      </div>
      <div v-else-if="activeTab === 'favorites'" class="fav-board-grid">
        <div v-for="b in tabData" :key="b.id" class="fav-board-card" @click="goBoard(b)">
          <div class="fav-cover" :style="coverStyle(b.bookCover)"></div>
          <div class="fav-info">
            <h4 class="fav-title">{{ b.bookTitle }}</h4>
            <p class="fav-author" v-if="b.bookAuthor">{{ b.bookAuthor }}</p>
            <div class="fav-meta">
              <span v-if="b.sellerCount" class="fav-sellers">{{ b.sellerCount }}卖家</span>
              <span v-if="b.minPrice" class="fav-price">¥{{ b.minPrice }}起</span>
              <span v-else class="fav-empty">暂无卖家</span>
            </div>
          </div>
          <el-button text type="danger" size="small" @click.stop="unfavorite(b)">取消收藏</el-button>
        </div>
      </div>
      <div v-else-if="activeTab === 'wishlist'" class="fav-board-grid">
        <div v-for="w in tabData" :key="w.id" class="fav-board-card" @click="goBoard(w.book || w)">
          <div class="fav-cover" :style="coverStyle(w.book?.bookCover)"></div>
          <div class="fav-info">
            <h4 class="fav-title">{{ w.book?.bookTitle || w.title || (w.isbn ? `ISBN ${w.isbn}` : '未知书目') }}</h4>
            <p class="fav-author" v-if="w.book?.bookAuthor">{{ w.book.bookAuthor }}</p>
            <p class="fav-author" v-else-if="w.author">{{ w.author }}</p>
            <div class="fav-meta">
              <span v-if="w.sellerCount" class="fav-sellers">{{ w.sellerCount }}卖家在售</span>
              <span v-else class="fav-empty">暂无卖家</span>
              <span class="fav-publisher" v-if="w.book?.bookPublisher">{{ w.book.bookPublisher }}</span>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-if="!tabData.length && activeTab !== 'products'" :description="'暂无数据'" />
    </div>

    <el-dialog v-model="showEmailDialog" title="更改邮箱" width="440px">
      <el-form label-position="top">
        <el-form-item label="新邮箱">
          <el-input v-model="emailForm.email" placeholder="请输入新邮箱" />
        </el-form-item>
        <el-form-item label="验证码">
          <div class="code-row">
            <el-input v-model="emailForm.code" placeholder="6位验证码" maxlength="6" />
            <el-button @click="sendChangeCode" :disabled="emailCooldown > 0 || sendingCode" :loading="sendingCode">
              {{ emailCooldown > 0 ? `${emailCooldown}s` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEmailDialog = false">取消</el-button>
        <el-button type="primary" @click="submitChangeEmail" :loading="changingEmail">确认更改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productApi, wishlistApi, bookFavoriteApi, authApi, conversationApi } from '@/api'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const router = useRouter()
const activeTab = ref('products')
const tabData = ref([])
const loading = ref(false)
const productFilter = ref('available')
const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23eee" width="80" height="80"/><text x="50%" y="50%" fill="%23aaa" text-anchor="middle" dy=".3em" font-size="12">无图</text></svg>'

const showEmailDialog = ref(false)
const emailForm = ref({ email: '', code: '' })
const emailCooldown = ref(0)
const sendingCode = ref(false)
const changingEmail = ref(false)
let cooldownTimer = null

const emailRegex = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

const availableProducts = computed(() => tabData.value.filter(p => p.status === 'available'))
const soldProducts = computed(() => tabData.value.filter(p => p.status !== 'available'))
const filteredProducts = computed(() => productFilter.value === 'available' ? availableProducts.value : soldProducts.value)

async function loadTabData() {
  loading.value = true
  try {
    if (activeTab.value === 'products') {
      const res = await productApi.myProducts()
      tabData.value = res.data || res || []
    } else if (activeTab.value === 'favorites') {
      const res = await bookFavoriteApi.list()
      tabData.value = res.data || res || []
    } else if (activeTab.value === 'wishlist') {
      const res = await wishlistApi.list()
      tabData.value = res.data || res || []
    }
  } finally {
    loading.value = false
  }
}

function goProduct(p) {
  router.push(`/product/${p.id}`)
}

function goBoard(b) {
  const key = b?.isbn || b?.bookTitle || b?.title
  if (!key) return
  router.push(`/book/${encodeURIComponent(key)}`)
}

function coverStyle(cover) {
  if (!cover) return {}
  return { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
}

async function unfavorite(b) {
  try {
    await bookFavoriteApi.toggle(b.id)
    ElMessage.success('已取消收藏')
    loadTabData()
  } catch {}
}

async function deleteProduct(p) {
  try {
    await ElMessageBox.confirm(`确定删除「${p.bookTitle || p.title}」吗？`, '提示', { type: 'warning' })
    await productApi.delete(p.id)
    ElMessage.success('删除成功')
    loadTabData()
  } catch {}
}

async function contactBuyer(p) {
  if (!p.buyer?.id) return
  try {
    await conversationApi.start(p.buyer.id, p.id)
    ElMessage.success('已创建对话，请前往「对话」查看')
    router.push('/chat')
  } catch {}
}

async function sendChangeCode() {
  const email = emailForm.value.email.trim()
  if (!email) return ElMessage.warning('请输入新邮箱')
  if (!emailRegex.test(email)) return ElMessage.warning('邮箱格式不正确')
  sendingCode.value = true
  try {
    await authApi.sendChangeEmailCode(email)
    ElMessage.success('验证码已发送')
    emailCooldown.value = 60
    cooldownTimer = setInterval(() => {
      emailCooldown.value--
      if (emailCooldown.value <= 0) clearInterval(cooldownTimer)
    }, 1000)
  } catch {} finally {
    sendingCode.value = false
  }
}

async function submitChangeEmail() {
  const { email, code } = emailForm.value
  if (!email || !code) return ElMessage.warning('请填写完整')
  if (!emailRegex.test(email)) return ElMessage.warning('邮箱格式不正确')
  changingEmail.value = true
  try {
    const res = await authApi.changeEmail(email, code)
    if (res.data?.user) {
      userStore.setAuth(userStore.token, res.data.user)
    }
    ElMessage.success('邮箱修改成功')
    showEmailDialog.value = false
    emailForm.value = { email: '', code: '' }
  } catch {} finally {
    changingEmail.value = false
  }
}

onMounted(() => {
  userStore.fetchProfile()
  loadTabData()
})
onUnmounted(() => { if (cooldownTimer) clearInterval(cooldownTimer) })
</script>

<style scoped>
.profile-card {
  display: flex;
  align-items: center;
  gap: 20px;
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 20px;
}
.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}
.profile-info h3 {
  font-size: 20px;
  margin-bottom: 4px;
}
.profile-info p {
  color: #999;
}
.user-no {
  color: #42a5f5 !important;
  font-weight: 600;
  letter-spacing: 1px;
}
.my-products {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.status-filter {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.filter-btn {
  padding: 8px 22px;
  border-radius: 20px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.25s;
}
.filter-btn:hover {
  border-color: #42a5f5;
  color: #42a5f5;
}
.filter-btn.active {
  background: #42a5f5;
  border-color: #42a5f5;
  color: #fff;
  box-shadow: 0 4px 12px rgba(66, 165, 245, 0.35);
}
.my-product-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 10px;
  padding: 12px 16px;
  gap: 12px;
}
.my-product-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}
.buyer-name {
  font-size: 13px;
  color: #42a5f5;
}
.status-on {
  color: #43a047;
}
.status-off {
  color: #999;
}
.my-product-info {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  cursor: pointer;
  min-width: 0;
}
.my-product-cover {
  width: 48px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}
.my-product-text {
  min-width: 0;
}
.my-product-title {
  font-size: 15px;
  font-weight: 500;
  color: #0d2847;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 6px;
}
.my-product-meta {
  display: flex;
  gap: 10px;
  align-items: center;
}
.my-product-price {
  color: #e53935;
  font-weight: 700;
  font-size: 16px;
}
.my-product-status {
  font-size: 12px;
  color: #999;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
}
.fav-board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.fav-board-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
}
.fav-board-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.fav-cover {
  height: 120px;
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  background-size: cover;
  background-position: center;
}
.fav-info {
  padding: 12px 16px;
  flex: 1;
}
.fav-title {
  font-size: 15px;
  font-weight: 600;
  color: #0d2847;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fav-author {
  font-size: 13px;
  color: #78909c;
  margin-bottom: 8px;
}
.fav-meta {
  display: flex;
  gap: 10px;
  font-size: 12px;
}
.fav-sellers {
  color: #43a047;
  font-weight: 600;
}
.fav-price {
  color: #e53935;
  font-weight: 600;
}
.fav-empty {
  color: #bbb;
}
.fav-publisher {
  color: #90a4ae;
}
.code-row {
  display: flex;
  gap: 10px;
  width: 100%;
}

@media (max-width: 768px) {
  .profile-card {
    padding: 16px;
    gap: 14px;
    border-radius: 12px;
  }
  .avatar {
    width: 60px;
    height: 60px;
  }
  .profile-info h3 {
    font-size: 18px;
  }
  .profile-info p {
    font-size: 13px;
  }
  .filter-btn {
    padding: 6px 16px;
    font-size: 13px;
  }
  .my-product-item {
    flex-direction: column;
    align-items: stretch;
    padding: 12px 14px;
  }
  .my-product-actions {
    justify-content: flex-end;
  }
  .my-product-actions .el-button + .el-button {
    margin-left: 0;
  }
  .my-product-title {
    font-size: 14px;
  }
  .my-product-price {
    font-size: 15px;
  }
  .fav-board-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .fav-cover {
    height: 100px;
  }
  .fav-info {
    padding: 10px 12px;
  }
  .fav-title {
    font-size: 14px;
  }
}
</style>