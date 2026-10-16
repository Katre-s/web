<template>
  <div class="admin-page">
    <div class="admin-sidebar">
      <div class="admin-logo">
        <span class="logo-seal">衡</span>
        <div class="logo-text">
          <b>文衡管理台</b>
          <span>WENHENG ADMIN</span>
        </div>
      </div>

      <el-menu :default-active="activeSection" class="admin-menu">
        <el-menu-item index="dashboard" @click="activeSection = 'dashboard'">
          <el-icon><DataBoard /></el-icon><span>数据概览</span>
        </el-menu-item>
        <el-menu-item index="posts" @click="switchSection('posts')">
          <el-icon><ChatDotRound /></el-icon><span>帖子管理</span>
        </el-menu-item>
        <el-menu-item index="notifications" @click="activeSection = 'notifications'">
          <el-icon><Bell /></el-icon><span>通知管理</span>
        </el-menu-item>
        <el-menu-item index="books" @click="activeSection = 'books'">
          <el-icon><Reading /></el-icon><span>新书上架</span>
        </el-menu-item>
        <el-menu-item index="users" @click="switchSection('users')">
          <el-icon><User /></el-icon><span>用户管理</span>
        </el-menu-item>
      </el-menu>

      <div class="admin-sidebar-footer">
        <el-button text class="back-btn" @click="$router.push('/')">
          <el-icon><Back /></el-icon> 返回前台
        </el-button>
      </div>
    </div>

    <div class="admin-main">
      <div class="admin-header">
        <h2 class="admin-title">{{ sectionTitle }}</h2>
        <div class="admin-user-info">
          <span class="admin-role-tag">管理员</span>
          <span>{{ userStore.userInfo?.nickname }}</span>
        </div>
      </div>

      <div class="admin-content">
        <!-- ===== 数据概览 ===== -->
        <template v-if="activeSection === 'dashboard'">
          <div class="stat-grid">
            <div class="stat-card" v-for="s in statCards" :key="s.label">
              <div class="stat-icon" :style="{ background: s.color }">
                <el-icon :size="22"><component :is="s.icon" /></el-icon>
              </div>
              <div class="stat-body">
                <b class="stat-num">{{ s.value }}</b>
                <span class="stat-label">{{ s.label }}</span>
              </div>
            </div>
          </div>

          <div class="panel">
            <h3 class="panel-title">最新注册用户</h3>
            <el-table :data="stats?.recentUsers || []" size="small">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column prop="email" label="邮箱" />
              <el-table-column prop="nickname" label="昵称" width="120" />
              <el-table-column prop="campus" label="校区" width="100" />
              <el-table-column label="角色" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.role === 'admin' ? 'danger' : 'info'">{{ row.role === 'admin' ? '管理员' : '用户' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'banned' ? 'danger' : 'success'">{{ row.status === 'banned' ? '已封禁' : '正常' }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <!-- ===== 帖子管理 ===== -->
        <template v-if="activeSection === 'posts'">
          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">校园热点帖子</h3>
              <el-button size="small" @click="loadPosts">刷新</el-button>
            </div>
            <el-table :data="posts" size="small">
              <el-table-column prop="sort_order" label="顺序" width="70" />
              <el-table-column prop="tag" label="分类" width="90">
                <template #default="{ row }"><el-tag size="small">{{ row.tag }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="title" label="标题" min-width="160" />
              <el-table-column prop="author" label="作者" width="100" />
              <el-table-column prop="description" label="内容" min-width="200" show-overflow-tooltip />
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '展示中' : '已删除' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="190" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="primary" :disabled="row.status !== 'active'" @click="movePost(row, 'up')">上移</el-button>
                  <el-button size="small" text type="primary" :disabled="row.status !== 'active'" @click="movePost(row, 'down')">下移</el-button>
                  <el-button size="small" text type="danger" :disabled="row.status !== 'active'" @click="removePost(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <!-- ===== 通知管理 ===== -->
        <template v-if="activeSection === 'notifications'">
          <div class="panel">
            <h3 class="panel-title">发送通知给全部用户</h3>
            <el-input v-model="broadcastContent" type="textarea" :rows="3" placeholder="输入广播内容，发给所有用户" />
            <div class="panel-actions">
              <el-button type="primary" @click="broadcast">发送广播</el-button>
            </div>
          </div>

          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">发送通知给单个用户</h3>
              <el-button size="small" @click="loadUsersForSelect">刷新用户列表</el-button>
            </div>
            <div class="single-send-row">
              <el-select v-model="singleUserId" filterable placeholder="选择用户" style="width: 300px">
                <el-option
                  v-for="u in userOptions"
                  :key="u.id"
                  :label="`${u.nickname}（${u.email}）`"
                  :value="u.id"
                />
              </el-select>
              <el-input v-model="singleContent" placeholder="通知内容" style="width: 320px" />
            </div>
            <div class="panel-actions">
              <el-button type="primary" @click="sendSingle">发送</el-button>
            </div>
          </div>

          <div class="panel">
            <h3 class="panel-title">操作日志提示</h3>
            <p class="muted-text">用户端的通知会显示在右上角铃铛中，点击可标记已读。</p>
          </div>
        </template>

        <!-- ===== 新书上架 ===== -->
        <template v-if="activeSection === 'books'">
          <div class="panel">
            <h3 class="panel-title">上架新书</h3>
            <el-form :model="bookForm" label-position="top" class="book-admin-form">
              <div class="form-grid">
                <el-form-item label="书名 *">
                  <el-input v-model="bookForm.bookTitle" placeholder="请输入书名" />
                </el-form-item>
                <el-form-item label="作者 *">
                  <el-input v-model="bookForm.bookAuthor" placeholder="请输入作者" />
                </el-form-item>
                <el-form-item label="出版社">
                  <el-input v-model="bookForm.bookPublisher" placeholder="请输入出版社" />
                </el-form-item>
                <el-form-item label="版本号">
                  <el-input v-model="bookForm.edition" placeholder="如：第3版" />
                </el-form-item>
                <el-form-item label="ISBN">
                  <el-input v-model="bookForm.isbn" placeholder="选填" />
                </el-form-item>
                <el-form-item label="分类">
                  <el-select v-model="bookForm.category" style="width: 100%">
                    <el-option label="教材" value="教材" />
                    <el-option label="小说" value="小说" />
                    <el-option label="考研" value="考研" />
                    <el-option label="文学" value="文学" />
                    <el-option label="其他" value="其他" />
                  </el-select>
                </el-form-item>
                <el-form-item label="建议价格（元）*">
                  <el-input-number v-model="bookForm.price" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
                <el-form-item label="原价（元）">
                  <el-input-number v-model="bookForm.originalPrice" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
              </div>
              <el-form-item label="书籍简介">
                <el-input v-model="bookForm.description" type="textarea" :rows="4" placeholder="请输入书籍简介" />
              </el-form-item>
              <el-form-item label="图书图片">
                <el-upload
                  list-type="picture-card"
                  accept="image/*"
                  :auto-upload="false"
                  :on-change="onBookImagesChange"
                  :file-list="bookFileList"
                  :limit="6"
                >
                  <el-icon><Plus /></el-icon>
                </el-upload>
              </el-form-item>
              <el-button type="primary" :loading="bookSubmitting" @click="submitBook">确认上架</el-button>
            </el-form>
          </div>
        </template>

        <!-- ===== 用户管理 ===== -->
        <template v-if="activeSection === 'users'">
          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">用户列表</h3>
              <el-input v-model="userKeyword" placeholder="搜索邮箱/昵称/姓名" clearable style="width: 240px" @keyup.enter="loadUsers" @clear="loadUsers">
                <template #append><el-button @click="loadUsers">搜索</el-button></template>
              </el-input>
            </div>
            <el-table :data="userList" size="small">
              <el-table-column prop="id" label="ID" width="60" />
              <el-table-column prop="email" label="邮箱" min-width="170" />
              <el-table-column prop="nickname" label="昵称" width="100" />
              <el-table-column prop="realName" label="姓名" width="90" />
              <el-table-column prop="campus" label="校区" width="90" />
              <el-table-column label="角色" width="100">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.role === 'admin' ? 'danger' : 'info'">{{ row.role === 'admin' ? '管理员' : '用户' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'banned' ? 'danger' : 'success'">{{ row.status === 'banned' ? '已封禁' : '正常' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="220" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="primary" @click="toggleRole(row)">{{ row.role === 'admin' ? '取消管理员' : '设为管理员' }}</el-button>
                  <el-button size="small" :type="row.status === 'banned' ? 'success' : 'danger'" plain @click="toggleBan(row)">
                    {{ row.status === 'banned' ? '解封' : '封号' }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="pagination-row">
              <el-pagination
                layout="prev, pager, next"
                :total="userTotal"
                :page-size="userPageSize"
                :current-page="userPage"
                @current-change="(p) => { userPage = p; loadUsers() }"
              />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  DataBoard, ChatDotRound, Bell, Reading, User, Back, Plus
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { hotspotApi, notificationApi, adminApi } from '@/api'

const userStore = useUserStore()
const activeSection = ref('dashboard')
const stats = ref(null)

const statCards = computed(() => [
  { label: '用户总数', value: stats.value?.userCount ?? '-', icon: User, color: 'linear-gradient(135deg,#5c6bc0,#3949ab)' },
  { label: '在售商品', value: stats.value?.productCount ?? '-', icon: Reading, color: 'linear-gradient(135deg,#26a69a,#00897b)' },
  { label: '订单总数', value: stats.value?.orderCount ?? '-', icon: DataBoard, color: 'linear-gradient(135deg,#ec407a,#d81b60)' },
  { label: '热点帖子', value: stats.value?.hotspotCount ?? '-', icon: ChatDotRound, color: 'linear-gradient(135deg,#ffa726,#fb8c00)' },
  { label: '已封禁用户', value: stats.value?.bannedCount ?? '-', icon: Bell, color: 'linear-gradient(135deg,#ef5350,#e53935)' }
])

const sectionTitle = computed(() => ({
  dashboard: '数据概览',
  posts: '帖子管理',
  notifications: '通知管理',
  books: '新书上架',
  users: '用户管理'
}[activeSection.value]))

async function loadStats() {
  try {
    const res = await adminApi.stats()
    stats.value = res.data
  } catch {}
}

/* ---- 帖子管理 ---- */
const posts = ref([])
async function loadPosts() {
  try {
    const res = await hotspotApi.adminList()
    posts.value = res.data || []
  } catch {}
}
async function movePost(row, direction) {
  try {
    await hotspotApi.move(row.id, direction)
    ElMessage.success('顺序已调整')
    loadPosts()
  } catch {}
}
async function removePost(row) {
  try {
    await ElMessageBox.confirm(`确定删除帖子「${row.title}」？`, '提示', { type: 'warning' })
    await hotspotApi.remove(row.id)
    ElMessage.success('已删除')
    loadPosts()
  } catch {}
}
function switchSection(name) {
  activeSection.value = name
  if (name === 'posts') loadPosts()
  if (name === 'users') loadUsers()
}

/* ---- 通知管理 ---- */
const broadcastContent = ref('')
const singleUserId = ref(null)
const singleContent = ref('')
const userOptions = ref([])

async function broadcast() {
  if (!broadcastContent.value) {
    ElMessage.warning('请输入通知内容')
    return
  }
  try {
    await notificationApi.broadcast(broadcastContent.value)
    ElMessage.success('广播已发送')
    broadcastContent.value = ''
  } catch {}
}
async function loadUsersForSelect() {
  try {
    const res = await adminApi.users({ page: 1, pageSize: 100 })
    userOptions.value = res.data?.list || []
  } catch {}
}
async function sendSingle() {
  if (!singleUserId.value || !singleContent.value) {
    ElMessage.warning('请选择用户并填写内容')
    return
  }
  try {
    await notificationApi.sendToOne(singleUserId.value, singleContent.value)
    ElMessage.success('通知已发送')
    singleContent.value = ''
  } catch {}
}

/* ---- 新书上架 ---- */
const bookForm = reactive({
  bookTitle: '', bookAuthor: '', bookPublisher: '', edition: '',
  isbn: '', category: '教材', price: null, originalPrice: null, description: ''
})
const bookFileList = ref([])
const bookImages = ref([])
const bookSubmitting = ref(false)

function onBookImagesChange(file, files) {
  bookImages.value = files.map((f) => f.raw)
}
async function submitBook() {
  if (!bookForm.bookTitle || !bookForm.bookAuthor || bookForm.price == null) {
    ElMessage.warning('请填写书名、作者和建议价格')
    return
  }
  bookSubmitting.value = true
  try {
    const fd = new FormData()
    Object.entries(bookForm).forEach(([k, v]) => fd.append(k, v ?? ''))
    bookImages.value.forEach((img) => fd.append('images', img))
    await adminApi.createBook(fd)
    ElMessage.success('新书上架成功')
    Object.assign(bookForm, { bookTitle: '', bookAuthor: '', bookPublisher: '', edition: '', isbn: '', category: '教材', price: null, originalPrice: null, description: '' })
    bookFileList.value = []
    bookImages.value = []
  } catch {
  } finally {
    bookSubmitting.value = false
  }
}

/* ---- 用户管理 ---- */
const userList = ref([])
const userTotal = ref(0)
const userPage = ref(1)
const userPageSize = 10
const userKeyword = ref('')

async function loadUsers() {
  try {
    const res = await adminApi.users({ page: userPage.value, pageSize: userPageSize, keyword: userKeyword.value })
    userList.value = res.data?.list || []
    userTotal.value = res.data?.total || 0
  } catch {}
}
async function toggleBan(row) {
  const ban = row.status !== 'banned'
  try {
    await ElMessageBox.confirm(ban ? `确定封禁用户「${row.nickname}」？` : `确定解封「${row.nickname}」？`, '提示', { type: 'warning' })
    await adminApi.updateUser(row.id, { status: ban ? 'banned' : 'active' })
    ElMessage.success(ban ? '已封禁' : '已解封')
    loadUsers()
  } catch {}
}
async function toggleRole(row) {
  const makeAdmin = row.role !== 'admin'
  try {
    await ElMessageBox.confirm(makeAdmin ? `确定将「${row.nickname}」设为管理员？` : `确定取消「${row.nickname}」的管理员身份？`, '提示', { type: 'warning' })
    await adminApi.updateUser(row.id, { role: makeAdmin ? 'admin' : 'user' })
    ElMessage.success('操作成功')
    if (row.id === userStore.userInfo?.id) {
      userStore.userInfo.role = makeAdmin ? 'admin' : 'user'
    }
    loadUsers()
  } catch {}
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.admin-page {
  display: flex;
  min-height: calc(100vh - 64px);
  background: transparent;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(180, 160, 120, 0.25);
  box-shadow: 0 10px 40px rgba(60, 50, 30, 0.12);
}

/* 侧边栏 */
.admin-sidebar {
  width: 220px;
  background: linear-gradient(180deg, #1e2430 0%, #171c26 100%);
  color: #d8d2c2;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.admin-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.logo-seal {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: #b5442f;
  color: #f7f3ea;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(181, 68, 47, 0.4);
}
.logo-text b {
  display: block;
  font-size: 16px;
  letter-spacing: 2px;
  color: #efe8dc;
}
.logo-text span {
  font-size: 10px;
  letter-spacing: 2px;
  color: rgba(216, 210, 194, 0.5);
}
.admin-menu {
  flex: 1;
  border: none;
  background: transparent;
  --el-menu-text-color: #c8c2b2;
  --el-menu-hover-bg-color: rgba(255, 255, 255, 0.06);
  --el-menu-active-color: #d6b56a;
  --el-menu-bg-color: transparent;
}
.admin-menu :deep(.el-menu-item) {
  height: 50px;
  margin: 4px 10px;
  border-radius: 10px;
}
.admin-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, rgba(214, 181, 106, 0.18), rgba(214, 181, 106, 0.06));
  color: #d6b56a;
}
.admin-sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.back-btn {
  color: #c8c2b2;
  width: 100%;
  justify-content: flex-start;
}

/* 主区 */
.admin-main {
  flex: 1;
  background: linear-gradient(180deg, rgba(255, 253, 248, 0.95), rgba(247, 242, 230, 0.95));
  padding: 24px 28px;
  min-width: 0;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.admin-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 3px;
  color: #3b3020;
  font-family: 'KaiTi', 'STKaiti', serif;
}
.admin-user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #6b5c40;
}
.admin-role-tag {
  background: #b5442f;
  color: #fff;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  letter-spacing: 1px;
}
.admin-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 统计卡片 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.stat-card {
  background: #fff;
  border-radius: 14px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(180, 160, 120, 0.2);
  box-shadow: 0 4px 16px rgba(60, 50, 30, 0.07);
  transition: all 0.3s;
}
.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(60, 50, 30, 0.12);
}
.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-num {
  display: block;
  font-size: 24px;
  color: #3b3020;
}
.stat-label {
  font-size: 12px;
  color: #9a8a6c;
}

/* 面板 */
.panel {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 14px;
  padding: 20px;
  border: 1px solid rgba(180, 160, 120, 0.2);
  box-shadow: 0 4px 16px rgba(60, 50, 30, 0.06);
}
.panel-title {
  font-size: 16px;
  color: #3b3020;
  margin-bottom: 16px;
  font-weight: 700;
  letter-spacing: 1px;
}
.panel-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.panel-toolbar .panel-title {
  margin-bottom: 0;
}
.panel-actions {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}
.muted-text {
  color: #9a8a6c;
  font-size: 13px;
}
.single-send-row {
  display: flex;
  gap: 12px;
  align-items: center;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0 20px;
}
.book-admin-form :deep(.el-form-item__label) {
  font-weight: 600;
  color: #5c4a28;
}
.pagination-row {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 860px) {
  .admin-page { flex-direction: column; }
  .admin-sidebar { width: 100%; }
  .single-send-row { flex-direction: column; align-items: flex-start; }
}
</style>