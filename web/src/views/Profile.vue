<template>
  <div class="profile-page">
    <h2 class="page-title">{{ $t('profile.title') }}</h2>
    <div class="profile-card">
      <div class="avatar-wrap" @click="pickAvatar">
        <img :src="thumb(userStore.userInfo?.avatar, 96) || defaultUserAvatar" class="avatar" />
        <div class="avatar-mask" v-loading="avatarUploading">
          <span>{{ avatarUploading ? $t('profile.avatarUploading') : $t('profile.changeAvatar') }}</span>
        </div>
        <span class="avatar-edit-badge">📷</span>
        <input ref="avatarInput" type="file" accept="image/*" class="avatar-input" @change="onAvatarChange" />
      </div>
      <div class="profile-info">
        <h3>{{ userStore.userInfo?.nickname }}</h3>
        <p class="user-no">ID：{{ userStore.userInfo?.userNo || t('common.unassigned') }}</p>
        <p>{{ $t('profile.email') }}：{{ userStore.userInfo?.email }} <el-button text type="primary" size="small" @click="showEmailDialog = true">{{ $t('profile.change') }}</el-button></p>
        <div class="profile-balance">
          {{ $t('profile.balance') }}：<b>¥{{ Number(userStore.userInfo?.balance ?? 0).toFixed(2) }}</b>
          <span class="pending-balance">{{ $t('profile.pendingBalance') }}：<b>¥{{ Number(userStore.userInfo?.pendingBalance ?? 0).toFixed(2) }}</b></span>
          <el-button type="primary" size="small" round @click="showRechargeDialog = true">{{ $t('profile.rechargeTitle') }}</el-button>
          <el-button size="small" round @click="openLogs">{{ $t('profile.balanceLogs') }}</el-button>
          <!-- 主题 / AI 音色：从两张整块卡片收成两个小按钮，跟在余额流水右边 -->
          <ThemeSwitcher inline compact />
          <VoiceSwitcher inline compact />
        </div>
      </div>
    </div>

    <el-tabs v-model="activeTab" @tab-change="loadTabData">
      <el-tab-pane :label="$t('profile.myProducts')" name="products" />
      <el-tab-pane :label="$t('profile.favorites')" name="favorites" />
      <el-tab-pane :label="$t('profile.myPosts')" name="posts" />
    </el-tabs>

    <div v-loading="loading">
      <div v-if="activeTab === 'products'" class="my-products">
        <div class="status-filter">
          <button class="filter-btn" :class="{ active: productFilter === 'available' }" @click="productFilter = 'available'">
            {{ $t('profile.availableCount', { n: availableProducts.length }) }}
          </button>
          <button class="filter-btn" :class="{ active: productFilter === 'sold' }" @click="productFilter = 'sold'">
            {{ $t('profile.soldCount', { n: soldProducts.length }) }}
          </button>
          <button class="filter-btn aftersale-btn" :class="{ active: productFilter === 'aftersales' }" @click="openSellerAftersales">
            {{ $t('profile.sellerAftersales') }}
            <em v-if="sellerAftersalePending" class="aftersale-dot">{{ sellerAftersalePending }}</em>
          </button>
        </div>

        <!-- 卖家售后处理 -->
        <div v-if="productFilter === 'aftersales'" class="seller-aftersales" v-loading="loadingSellerAftersales">
          <div v-for="rec in sellerAftersales" :key="rec.id" class="seller-aftersale-item">
            <div class="sa-head">
              <span class="sa-order">{{ $t('orders.idPrefix') }}{{ rec.orderId }}</span>
              <span class="sa-type">{{ rec.type === 'return_refund' ? $t('orders.typeReturnRefund') : $t('orders.typeRefundOnly') }}</span>
              <el-tag size="small" :type="saTagType(rec.status)">{{ saStatusLabel(rec.status) }}</el-tag>
              <span class="sa-amount">¥{{ Number(rec.amount || 0).toFixed(2) }}</span>
            </div>
            <p class="sa-buyer">{{ $t('admin.afterSaleBuyer') }}：{{ rec.buyer?.nickname || rec.buyer?.userNo || '—' }}</p>
            <p class="sa-reason"><b>{{ $t('orders.aftersaleReason') }}：</b>{{ rec.reason || '—' }}</p>
            <p v-if="rec.adminNote" class="sa-admin"><b>{{ $t('orders.aftersaleNote') }}：</b>{{ rec.adminNote }}</p>
            <div class="sa-actions">
              <!-- 退货退款：确认收货并退款 -->
              <el-button
                v-if="rec.status === 'seller_pending' && rec.type === 'return_refund'"
                type="primary" size="small" round
                @click="handleSellerAftersale(rec, 'confirm')"
              >{{ $t('profile.confirmReturnRefund') }}</el-button>
              <!-- 仅退款：同意 / 拒绝 -->
              <template v-if="rec.status === 'seller_pending' && rec.type === 'refund_only'">
                <el-button type="primary" size="small" round @click="handleSellerAftersale(rec, 'agree')">{{ $t('profile.agreeRefund') }}</el-button>
                <el-button type="danger" size="small" round @click="rejectSellerAftersale(rec)">{{ $t('profile.rejectRefund') }}</el-button>
              </template>
              <span v-if="rec.status === 'seller_rejected'" class="sa-wait">{{ $t('profile.waitAdminReview') }}</span>
              <span v-if="rec.status === 'seller_reject_approved' && rec.appealed" class="sa-wait">{{ $t('profile.buyerAppealed') }}</span>
            </div>
          </div>
          <el-empty v-if="!sellerAftersales.length && !loadingSellerAftersales" :description="$t('profile.noSellerAftersales')" :image-size="60" />
        </div>
        <template v-if="productFilter !== 'aftersales'">
        <div v-for="p in filteredProducts" :key="p.id" class="my-product-item">
          <div class="my-product-info" @click="goProduct(p)">
            <img :src="thumb(p.bookCover || p.images?.[0]?.imagePath, 320) || defaultAvatar" class="my-product-cover" loading="lazy" />
            <div class="my-product-text">
              <div class="my-product-title">{{ p.bookTitle || p.title }}</div>
              <div class="my-product-meta">
                <span class="my-product-price">¥{{ p.price }}</span>
                <span class="my-product-status" :class="p.status === 'available' ? 'status-on' : 'status-off'">{{ p.status === 'available' ? t('common.available') : t('common.sold') }}</span>
                <span v-if="p.status === 'sold' && p.buyer" class="buyer-name">{{ $t('profile.buyerPrefix') }}{{ p.buyer.nickname }}</span>
              </div>
            </div>
          </div>
          <div class="my-product-actions">
            <el-button v-if="p.status === 'sold' && p.buyer" type="primary" size="small" round @click="contactBuyer(p)">{{ $t('common.contactBuyer') }}</el-button>
            <el-button type="danger" size="small" round @click="deleteProduct(p)">{{ $t('common.delete') }}</el-button>
          </div>
        </div>
        <el-empty v-if="!filteredProducts.length" :description="$t('common.noBooks')" />
        </template>
      </div>
      <div v-else-if="activeTab === 'favorites'" class="fav-products">
        <div v-for="f in favList" :key="f.key" class="fav-product-card" @click="openFav(f)">
          <img :src="favCover(f)" class="fav-cover" />
          <div class="fav-info">
            <h4 class="fav-title">{{ favTitle(f) }}</h4>
            <div class="fav-meta">
              <span class="fav-price">{{ favPrice(f) }}</span>
              <span class="fav-status" :class="favOnSale(f) ? 'status-on' : 'status-off'">
                <template v-if="f.kind === 'book'">
                  {{ f.book.sellerCount ? f.book.sellerCount + $t('common.seller') : $t('common.noSellers') }}
                </template>
                <template v-else>
                  {{ favOnSale(f) ? $t('common.available') : $t('common.sold') }}
                </template>
              </span>
            </div>
          </div>
          <el-button text type="danger" size="small" @click.stop="unfavorite(f)">{{ $t('common.unfav') }}</el-button>
        </div>
        <el-empty v-if="!favList.length" :description="t('common.empty')" />
      </div>

      <!-- 我的帖子：广场里自己发的动态 -->
      <div v-else-if="activeTab === 'posts'" class="my-posts">
        <article v-for="p in myPosts" :key="p.id" class="my-post-card">
          <div class="mp-head">
            <span class="mp-time">{{ formatPostTime(p.createdAt || p.created_at) }}</span>
            <el-tag v-if="p.status === 'hidden'" size="small" type="info">{{ t('profile.postHidden') }}</el-tag>
            <span class="mp-replies">💬 {{ Number(p.replyCount) || 0 }}</span>
            <el-button text type="danger" size="small" class="mp-del" @click="removeMyPost(p)">
              {{ $t('common.delete') }}
            </el-button>
          </div>
          <p class="mp-text" v-if="p.content">{{ p.content }}</p>
          <div class="mp-images" v-if="p.images && p.images.length">
            <img v-for="(img, i) in p.images.slice(0, 3)" :key="i" :src="thumb(img, 240)" class="mp-img" loading="lazy" />
            <span v-if="p.images.length > 3" class="mp-more">+{{ p.images.length - 3 }}</span>
          </div>
        </article>
        <el-empty v-if="!myPosts.length" :description="$t('profile.myPostsEmpty')" />
      </div>
    </div>

    <el-dialog v-model="showEmailDialog" :title="$t('profile.changeEmailTitle')" width="440px">
      <el-form label-position="top">
        <el-form-item :label="$t('profile.newEmail')">
          <el-input v-model="emailForm.email" :placeholder="$t('common.enterNewEmail')" />
        </el-form-item>
        <el-form-item :label="$t('profile.code')">
          <div class="code-row">
            <el-input v-model="emailForm.code" :placeholder="$t('profile.codePlaceholder')" maxlength="6" />
            <el-button @click="sendChangeCode" :disabled="emailCooldown > 0 || sendingCode" :loading="sendingCode">
              {{ emailCooldown > 0 ? `${emailCooldown}s` : t('common.getCode') }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEmailDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitChangeEmail" :loading="changingEmail">{{ $t('profile.confirmChange') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRechargeDialog" :title="$t('profile.rechargeTitle')" width="440px">
      <div class="quick-amounts">
        <button
          v-for="a in quickAmounts"
          :key="a"
          class="amount-btn"
          :class="{ active: rechargeAmount === a }"
          @click="rechargeAmount = a"
        >¥{{ a }}</button>
      </div>
      <el-form label-position="top" @submit.prevent>
        <el-form-item :label="$t('profile.rechargeAmount')">
          <el-input v-model.number="rechargeAmount" type="number" min="0.01" step="0.01" placeholder="0.00">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRechargeDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="recharging" @click="submitRecharge">{{ $t('profile.rechargeSubmit') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showLogsDialog" :title="$t('profile.balanceLogs')" width="480px">
      <div v-loading="loadingLogs" class="log-list">
        <div v-for="log in balanceLogs" :key="log.id" class="log-item">
          <div class="log-left">
            <span class="log-type" :class="log.type">{{ logTypeLabel(log.type) }}</span>
            <span class="log-note">{{ log.note || logTypeLabel(log.type) }}</span>
          </div>
          <div class="log-right">
            <span class="log-amount" :class="Number(log.amount) >= 0 ? 'plus' : 'minus'">
              {{ Number(log.amount) >= 0 ? '+' : '' }}¥{{ Number(log.amount).toFixed(2) }}
            </span>
            <span class="log-after">→ ¥{{ Number(log.balanceAfter).toFixed(2) }}</span>
          </div>
        </div>
        <el-empty v-if="!balanceLogs.length && !loadingLogs" :description="$t('profile.noLogs')" :image-size="60" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'
import { ElMessageBox } from 'element-plus/es/components/message-box/index'
import { productApi, favoriteApi, bookFavoriteApi, authApi, balanceApi, conversationApi, aftersaleApi, plazaApi } from '@/api'
import { useUserStore } from '@/stores/user'
import { resolveImg, thumb } from '@/utils/image'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import VoiceSwitcher from '@/components/VoiceSwitcher.vue'

const userStore = useUserStore()
const router = useRouter()
const activeTab = ref('products')
const myPosts = ref([])
const tabData = ref([])
const favList = ref([])
const loading = ref(false)
const productFilter = ref('available')
const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23eee" width="80" height="80"/><text x="50%" y="50%" fill="%23aaa" text-anchor="middle" dy=".3em" font-size="12">无图</text></svg>'
const defaultUserAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="%2310667a"/><text x="50%" y="50%" fill="%23fff" text-anchor="middle" dy=".35em" font-size="30">鱼</text></svg>'

/* ---------- 头像上传 ---------- */
const avatarInput = ref(null)
const avatarUploading = ref(false)

function pickAvatar() {
  if (!avatarUploading.value) avatarInput.value?.click()
}

async function onAvatarChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 15 * 1024 * 1024) {
    ElMessage.warning(t('profile.avatarTooLarge'))
    return
  }
  const formData = new FormData()
  formData.append('avatar', file)
  avatarUploading.value = true
  try {
    const res = await authApi.uploadAvatar(formData)
    if (res.data?.user) {
      userStore.setAuth(userStore.token, res.data.user)
    }
    ElMessage.success(res.message || t('common.success'))
  } catch {} finally {
    avatarUploading.value = false
  }
}

/* ---------- 充值与流水 ---------- */
const showRechargeDialog = ref(false)
const rechargeAmount = ref(50)
const recharging = ref(false)
const quickAmounts = [20, 50, 100, 200]

const showLogsDialog = ref(false)
const loadingLogs = ref(false)
const balanceLogs = ref([])

function submitRecharge() {
  const raw = Number(rechargeAmount.value)
  const cents = Math.round(raw * 100)
  if (!Number.isFinite(raw) || raw <= 0 || cents / 100 > 5000 || Math.abs(cents - raw * 100) > 1e-6) {
    ElMessage.warning(t('profile.rechargeInvalid'))
    return
  }
  const amount = cents / 100
  recharging.value = true
  balanceApi.recharge(amount)
    .then(() => {
      ElMessage.success(t('profile.rechargeSuccess', { amount: amount.toFixed(2) }))
      showRechargeDialog.value = false
      userStore.fetchProfile()
    })
    .catch(() => {})
    .finally(() => { recharging.value = false })
}

async function openLogs() {
  showLogsDialog.value = true
  loadingLogs.value = true
  try {
    const res = await balanceApi.logs()
    balanceLogs.value = res.data || res || []
  } finally {
    loadingLogs.value = false
  }
}

function logTypeLabel(type) {
  const map = {
    recharge: 'profile.logRecharge',
    pay: 'profile.logPay',
    income: 'profile.logIncome',
    admin: 'profile.logAdmin',
    refund: 'profile.logRefund',
    refund_hold: 'profile.logRefundHold',
    income_escrow: 'profile.logIncomeEscrow',
    escrow_release: 'profile.logEscrowRelease'
  }
  return t(map[type] || type)
}

/* ---------- 卖家售后处理 ---------- */
const sellerAftersales = ref([])
const loadingSellerAftersales = ref(false)
const sellerAftersalePending = computed(() =>
  sellerAftersales.value.filter(r => r.status === 'seller_pending').length
)

async function openSellerAftersales() {
  productFilter.value = 'aftersales'
  loadingSellerAftersales.value = true
  try {
    const res = await aftersaleApi.sellerList()
    sellerAftersales.value = res.data || res || []
  } catch {
    sellerAftersales.value = []
  } finally {
    loadingSellerAftersales.value = false
  }
}

function saStatusLabel(status) {
  const map = {
    pending: 'orders.aftersalePending',
    seller_pending: 'orders.aftersaleSellerPending',
    seller_rejected: 'orders.aftersaleSellerRejected',
    seller_reject_approved: 'orders.aftersaleRejectApproved',
    appealed: 'orders.aftersaleAppealed',
    refunded: 'orders.aftersaleRefunded',
    rejected: 'orders.aftersaleRejected',
    closed: 'orders.aftersaleClosed'
  }
  return map[status] ? t(map[status]) : status
}

function saTagType(status) {
  return {
    pending: 'warning', seller_pending: 'primary', seller_rejected: 'danger',
    seller_reject_approved: 'info', appealed: 'warning', refunded: 'success',
    rejected: 'info', closed: 'info'
  }[status] || 'info'
}

async function handleSellerAftersale(rec, action) {
  try {
    await aftersaleApi.sellerHandle(rec.id, { action })
    ElMessage.success(action === 'confirm' ? t('profile.confirmReturnRefundDone') : t('profile.agreeRefundDone'))
    openSellerAftersales()
  } catch {}
}

async function rejectSellerAftersale(rec) {
  let reason = ''
  try {
    const { value } = await ElMessageBox.prompt(t('profile.rejectReasonTip'), t('profile.rejectRefund'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      inputType: 'textarea',
      inputPlaceholder: t('profile.rejectReasonPlaceholder')
    })
    reason = String(value || '').trim()
  } catch { return }
  try {
    await aftersaleApi.sellerHandle(rec.id, { action: 'reject', reason })
    ElMessage.success(t('profile.rejectSubmitted'))
    openSellerAftersales()
  } catch {}
}

/* ---------- 邮箱修改 ---------- */
const showEmailDialog = ref(false)
const emailForm = ref({ email: '', code: '' })
const emailCooldown = ref(0)
const sendingCode = ref(false)
const changingEmail = ref(false)
let cooldownTimer = null

const emailRegex = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

/* ---------- 我的发布 / 物品收藏 ---------- */
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
      // 物品收藏 = 单件商品收藏 + 旧版书目收藏，兼容历史数据
      const [pf, bf] = await Promise.all([favoriteApi.list(), bookFavoriteApi.list()])
      const pList = Array.isArray(pf?.data) ? pf.data : (Array.isArray(pf) ? pf : [])
      const bList = Array.isArray(bf?.data) ? bf.data : (Array.isArray(bf) ? bf : [])
      favList.value = [
        ...pList.filter((f) => f && f.product).map((f) => ({
          key: `p${f.id}`,
          kind: 'product',
          id: f.id,
          productId: f.productId,
          product: f.product
        })),
        ...bList.filter((b) => b && b.id).map((b) => ({
          key: `b${b.id}`,
          kind: 'book',
          bookId: b.id,
          book: b
        }))
      ]
    } else if (activeTab.value === 'posts') {
      const res = await plazaApi.my({ pageSize: 30 })
      myPosts.value = res?.data?.list || []
    }
  } finally {
    loading.value = false
  }
}

/* ------------------------------ 我的帖子 ------------------------------ */
function formatPostTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function removeMyPost(post) {
  try {
    await ElMessageBox.confirm(t('plaza.deleteConfirm'), t('common.warning'), { type: 'warning' })
    await plazaApi.remove(post.id)
    myPosts.value = myPosts.value.filter((p) => p.id !== post.id)
    ElMessage.success(t('plaza.deleted'))
  } catch {
    // 取消：什么都不做
  }
}

function goProduct(p) {
  if (!p?.id) return
  router.push(`/product/${p.id}`)
}

function favCover(f) {
  if (f?.kind === 'book') return thumb(f.book?.bookCover, 320) || defaultAvatar
  const p = f?.product
  if (!p) return defaultAvatar
  return thumb(p.cover || p.bookCover || p.images?.[0]?.imagePath, 320) || defaultAvatar
}

function favTitle(f) {
  return f?.kind === 'book' ? f.book?.bookTitle : (f?.product?.title || f?.product?.bookTitle)
}

function favPrice(f) {
  if (f?.kind === 'book') {
    const min = Number(f.book?.minPrice) || 0
    return min ? `¥${min}${t('common.from')}` : '—'
  }
  return `¥${f?.product?.price ?? '—'}`
}

function favOnSale(f) {
  return f?.kind === 'book' ? Number(f.book?.sellerCount) > 0 : f?.product?.status === 'available'
}

function openFav(f) {
  if (f?.kind === 'book') {
    const key = f.book?.isbn || f.book?.bookTitle
    if (key) router.push(`/book/${encodeURIComponent(key)}`)
    return
  }
  goProduct(f?.product)
}

async function unfavorite(f) {
  try {
    if (f?.kind === 'book') await bookFavoriteApi.toggle(f.bookId)
    else await favoriteApi.toggle(f.productId)
    ElMessage.success(t('common.unfavDone'))
    loadTabData()
  } catch {}
}

async function deleteProduct(p) {
  try {
    await ElMessageBox.confirm(t('profile.deleteConfirm', { name: p.bookTitle || p.title }), t('common.hint'), { type: 'warning' })
    await productApi.delete(p.id)
    ElMessage.success(t('common.deleteSuccess'))
    loadTabData()
  } catch {}
}

async function contactBuyer(p) {
  if (!p.buyer?.id) return
  try {
    const res = await conversationApi.start(p.buyer.id, p.id)
    const convId = res?.data?.conversationId
    ElMessage.success(t('common.convCreated'))
    router.push(convId ? { name: 'Chat', query: { conv: String(convId) } } : '/chat')
  } catch {}
}

async function sendChangeCode() {
  const email = emailForm.value.email.trim()
  if (!email) return ElMessage.warning(t('common.enterNewEmail'))
  if (!emailRegex.test(email)) return ElMessage.warning(t('common.emailInvalid'))
  sendingCode.value = true
  try {
    await authApi.sendChangeEmailCode(email)
    ElMessage.success(t('common.codeSent'))
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
  if (!email || !code) return ElMessage.warning(t('common.fillAll'))
  if (!emailRegex.test(email)) return ElMessage.warning(t('common.emailInvalid'))
  changingEmail.value = true
  try {
    const res = await authApi.changeEmail(email, code)
    if (res.data?.user) {
      userStore.setAuth(userStore.token, res.data.user)
    }
    ElMessage.success(t('common.emailChanged'))
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
  background: var(--card-bg, #fff);
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 20px;
}
.avatar-wrap {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
}
.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}
/* 触屏设备没有 hover，头像遮罩常驻半透明，提示可以点击更换 */
@media (hover: none) {
  .avatar-mask {
    opacity: 0.55;
  }
}

.avatar-edit-badge {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #10667a;
  border: 2px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(13, 59, 79, 0.3);
  pointer-events: none;
}

.avatar-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 11px;
  opacity: 0;
  transition: opacity 0.25s;
}
.avatar-wrap:hover .avatar-mask {
  opacity: 1;
}
.avatar-input {
  display: none;
}
.profile-info h3 {
  font-size: 20px;
  margin-bottom: 4px;
}
.profile-info p {
  color: var(--text-sub, #999);
}
.pending-balance {
  margin-left: 14px;
  color: #8d6e63;
}
.pending-balance b {
  color: #b3591a;
}
.seller-aftersales {
  margin-top: 14px;
}
.seller-aftersale-item {
  padding: 12px 14px;
  border: 1px solid var(--card-border);
  border-radius: 12px;
  background: var(--card-bg);
  margin-bottom: 10px;
  font-size: 13px;
}
.sa-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sa-order {
  font-weight: 700;
  color: var(--text-main);
}
.sa-type {
  color: #10667a;
}
.sa-amount {
  margin-left: auto;
  font-weight: 800;
  color: #e5484d;
}
.sa-buyer, .sa-reason, .sa-admin {
  margin: 6px 0 0;
  color: #5d7b87;
  line-height: 1.6;
}
.sa-actions {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sa-wait {
  font-size: 12px;
  color: #b3591a;
}
.aftersale-dot {
  font-style: normal;
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 999px;
  background: #e5484d;
  color: #fff;
  font-size: 11px;
}
.profile-balance {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.profile-balance b {
  color: var(--accent-danger, #e53935);
  font-size: 18px;
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
  background: var(--card-bg, #fff);
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
  background: var(--card-bg, #fff);
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
  color: var(--text-main, #0d2847);
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
  color: var(--accent-danger, #e53935);
  font-weight: 700;
  font-size: 16px;
}
.my-product-status {
  font-size: 12px;
  color: #999;
  background: var(--bg-light, #f5f5f5);
  padding: 2px 8px;
  border-radius: 4px;
}
.fav-products {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 我的帖子 */
.my-posts {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.my-post-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--card-border, rgba(180, 160, 120, 0.18));
  border-radius: 12px;
  padding: 14px 16px;
  transition: box-shadow 0.22s ease;
}
.my-post-card:hover {
  box-shadow: 0 8px 22px -14px rgba(13, 40, 71, 0.4);
}
.mp-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mp-time {
  font-size: 12px;
  color: var(--text-sub, #9db2ba);
}
.mp-replies {
  font-size: 12px;
  color: var(--text-sub, #78909c);
}
.mp-del {
  margin-left: auto;
}
.mp-text {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-main);
  white-space: pre-wrap;
  word-break: break-word;
  /* 太长的动态收一收，列表里保持一眼能扫 */
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mp-images {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  align-items: center;
}
.mp-img {
  width: 78px;
  height: 78px;
  border-radius: 8px;
  object-fit: cover;
  background: #f0f4f6;
}
.mp-more {
  font-size: 12px;
  color: var(--text-sub, #9db2ba);
}
@media (max-width: 480px) {
  .mp-img {
    width: 62px;
    height: 62px;
  }
}
.fav-product-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--card-bg, #fff);
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: transform 0.25s;
}
.fav-product-card:hover {
  transform: translateX(4px);
}
.fav-cover {
  width: 48px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}
.fav-info {
  flex: 1;
  min-width: 0;
}
.fav-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-main, #0d2847);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fav-meta {
  display: flex;
  gap: 10px;
  align-items: center;
}
.fav-price {
  color: var(--accent-danger, #e53935);
  font-weight: 700;
  font-size: 15px;
}
.fav-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}
.fav-status.status-on {
  color: #43a047;
  background: rgba(67, 160, 71, 0.12);
}
.fav-status.status-off {
  color: #999;
  background: var(--bg-light, #f5f5f5);
}
.code-row {
  display: flex;
  gap: 10px;
  width: 100%;
}
.quick-amounts {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.amount-btn {
  flex: 1;
  min-width: 72px;
  padding: 10px 0;
  border-radius: 10px;
  border: 1px solid #dcdfe6;
  background: var(--card-bg, #fff);
  color: #606266;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s;
}
.amount-btn:hover {
  border-color: #42a5f5;
  color: #42a5f5;
}
.amount-btn.active {
  background: #42a5f5;
  border-color: #42a5f5;
  color: #fff;
  box-shadow: 0 4px 12px rgba(66, 165, 245, 0.35);
}
.log-list {
  max-height: 380px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.log-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border-light, #f0f0f0);
}
.log-item:last-child {
  border-bottom: none;
}
.log-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.log-type {
  font-size: 12px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 8px;
  width: fit-content;
}
.log-type.recharge {
  color: #42a5f5;
  background: rgba(66, 165, 245, 0.12);
}
.log-type.pay {
  color: #ff9800;
  background: rgba(255, 152, 0, 0.12);
}
.log-type.income {
  color: #43a047;
  background: rgba(67, 160, 71, 0.12);
}
.log-type.admin {
  color: #9c27b0;
  background: rgba(156, 39, 176, 0.12);
}
.log-note {
  font-size: 12px;
  color: var(--text-sub, #999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.log-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}
.log-amount {
  font-weight: 700;
  font-size: 14px;
}
.log-amount.plus {
  color: #43a047;
}
.log-amount.minus {
  color: var(--accent-danger, #e53935);
}
.log-after {
  font-size: 12px;
  color: var(--text-sub, #999);
}

@media (max-width: 768px) {
  .profile-card {
    padding: 16px;
    gap: 14px;
    border-radius: 12px;
  }
  .avatar-wrap,
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
  .profile-balance b {
    font-size: 16px;
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
  .fav-product-card {
    padding: 10px 12px;
    gap: 10px;
  }
  .fav-cover {
    width: 44px;
    height: 58px;
  }
  .fav-title {
    font-size: 14px;
  }
  .quick-amounts {
    gap: 8px;
  }
  .amount-btn {
    min-width: 60px;
    padding: 8px 0;
    font-size: 14px;
  }
}
</style>
