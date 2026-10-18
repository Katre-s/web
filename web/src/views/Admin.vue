<template>
  <div class="admin-page">
    <div class="admin-sidebar">
      <div class="admin-logo">
        <span class="logo-seal">衡</span>
        <div class="logo-text">
          <b>{{ $t('admin.title') }}</b>
          <span>WENHENG ADMIN</span>
        </div>
      </div>

      <el-menu :default-active="activeSection" class="admin-menu">
        <el-menu-item index="dashboard" @click="activeSection = 'dashboard'">
          <el-icon><DataBoard /></el-icon><span>{{ $t('admin.dashboard') }}</span>
        </el-menu-item>
        <el-menu-item index="posts" @click="switchSection('posts')">
          <el-icon><ChatDotRound /></el-icon><span>{{ $t('admin.posts') }}</span>
        </el-menu-item>
        <el-menu-item index="notifications" @click="activeSection = 'notifications'">
          <el-icon><Bell /></el-icon><span>{{ $t('admin.notifications') }}</span>
        </el-menu-item>
        <el-menu-item index="books" @click="activeSection = 'books'">
          <el-icon><Reading /></el-icon><span>{{ $t('admin.books') }}</span>
        </el-menu-item>
        <el-menu-item index="boards" @click="switchSection('boards')">
          <el-icon><Files /></el-icon><span>{{ $t('admin.boards') }}</span>
        </el-menu-item>
        <el-menu-item index="users" @click="switchSection('users')">
          <el-icon><User /></el-icon><span>{{ $t('admin.users') }}</span>
        </el-menu-item>
      </el-menu>

      <div class="admin-sidebar-footer">
        <el-button text class="back-btn" @click="$router.push('/')">
          <el-icon><Back /></el-icon>{{ $t('admin.back') }}</el-button>
      </div>
    </div>

    <div class="admin-main">
      <div class="admin-header">
        <h2 class="admin-title">{{ sectionTitle }}</h2>
        <div class="admin-user-info">
          <span class="admin-role-tag">{{ $t('common.admin') }}</span>
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
            <h3 class="panel-title">{{ $t('admin.latestUsers') }}</h3>
            <el-table :data="stats?.recentUsers || []" size="small">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column prop="email" :label="$t('profile.email')" />
              <el-table-column prop="nickname" :label="$t('admin.nickname')" width="120" />
              <el-table-column prop="campus" :label="$t('admin.campus')" width="100" />
              <el-table-column :label="$t('admin.role')" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.role === 'admin' ? 'danger' : 'info'">{{ row.role === 'admin' ? t('common.admin') : t('common.user') }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.status')" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'banned' ? 'danger' : 'success'">{{ row.status === 'banned' ? t('common.banned') : t('common.normal') }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <!-- ===== 帖子管理 ===== -->
        <template v-if="activeSection === 'posts'">
          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.hotPosts') }}</h3>
              <el-button size="small" @click="loadPosts">{{ $t('common.refresh') }}</el-button>
            </div>
            <el-table :data="posts" size="small">
              <el-table-column prop="sort_order" :label="$t('admin.sortOrder')" width="70" />
              <el-table-column prop="tag" :label="$t('home.category')" width="90">
                <template #default="{ row }"><el-tag size="small">{{ row.tag }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="title" :label="$t('home.title')" min-width="160" />
              <el-table-column prop="author" :label="$t('publish.author')" width="100" />
              <el-table-column prop="description" :label="$t('home.content')" min-width="200" show-overflow-tooltip />
              <el-table-column :label="$t('admin.status')" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? t('common.active') : t('common.deleted') }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('common.actions')" width="190" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="primary" :disabled="row.status !== 'active'" @click="movePost(row, 'up')">{{ $t('admin.moveUp') }}</el-button>
                  <el-button size="small" text type="primary" :disabled="row.status !== 'active'" @click="movePost(row, 'down')">{{ $t('admin.moveDown') }}</el-button>
                  <el-button size="small" text type="danger" :disabled="row.status !== 'active'" @click="removePost(row)">{{ $t('common.delete') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <!-- ===== 通知管理 ===== -->
        <template v-if="activeSection === 'notifications'">
          <div class="panel">
            <h3 class="panel-title">{{ $t('admin.broadcastTitle') }}</h3>
            <el-input v-model="broadcastContent" type="textarea" :rows="3" :placeholder="$t('admin.broadcastPlaceholder')" />
            <div class="panel-actions">
              <el-button type="primary" @click="broadcast">{{ $t('admin.broadcast') }}</el-button>
            </div>
          </div>

          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.singleTitle') }}</h3>
              <el-button size="small" @click="loadUsersForSelect">{{ $t('admin.refreshUsers') }}</el-button>
            </div>
            <div class="single-send-row">
              <el-select v-model="singleUserId" filterable :placeholder="$t('admin.selectUser')" style="width: 300px">
                <el-option
                  v-for="u in userOptions"
                  :key="u.id"
                  :label="`${u.nickname}（${u.email}）`"
                  :value="u.id"
                />
              </el-select>
              <el-input v-model="singleContent" :placeholder="$t('admin.notifContent')" style="width: 320px" />
            </div>
            <div class="panel-actions">
              <el-button type="primary" @click="sendSingle">{{ $t('common.send') }}</el-button>
            </div>
          </div>

          <div class="panel">
            <h3 class="panel-title">{{ $t('admin.logTip') }}</h3>
            <p class="muted-text">{{ $t('admin.logTipDesc') }}</p>
          </div>

          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.sentNotifs') }}</h3>
              <el-button size="small" @click="loadNotifList">{{ $t('common.refresh') }}</el-button>
            </div>
            <el-table :data="notifList" size="small">
              <el-table-column :label="$t('admin.type')" width="90">
                <template #default="{ row }">
                  <el-tag :type="row.type === 'broadcast' ? 'warning' : 'info'" size="small">
                    {{ row.type === 'broadcast' ? t('admin.broadcastType') : t('admin.singleType') }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="content" :label="$t('home.content')" min-width="250" show-overflow-tooltip />
              <el-table-column prop="time" :label="$t('admin.time')" width="160" />
              <el-table-column :label="$t('common.actions')" width="90" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="danger" @click="deleteNotif(row)">{{ $t('common.delete') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <!-- ===== 新书上架 ===== -->
        <template v-if="activeSection === 'books'">
          <div class="panel">
            <h3 class="panel-title">{{ $t('admin.addBookTitle') }}</h3>
            <el-form :model="bookForm" label-position="top" class="book-admin-form">
              <div class="form-grid">
                <el-form-item :label="$t('publish.bookTitle')">
                  <el-input v-model="bookForm.bookTitle" :placeholder="$t('publish.placeholderTitle')" />
                </el-form-item>
                <el-form-item :label="$t('admin.authorStar')">
                  <el-input v-model="bookForm.bookAuthor" :placeholder="$t('publish.placeholderAuthor')" />
                </el-form-item>
                <el-form-item :label="$t('publish.publisher')">
                  <el-input v-model="bookForm.bookPublisher" :placeholder="$t('publish.placeholderPublisher')" />
                </el-form-item>
                <el-form-item :label="$t('publish.edition')">
                  <el-input v-model="bookForm.edition" :placeholder="$t('publish.editionPlaceholder')" />
                </el-form-item>
                <el-form-item label="ISBN">
                  <el-input v-model="bookForm.isbn" :placeholder="$t('publish.optional')" />
                </el-form-item>
                <el-form-item :label="$t('home.category')">
                  <el-select v-model="bookForm.category" style="width: 100%">
                    <el-option :label="$t('publish.catTextbook')" value="教材" />
                    <el-option :label="$t('publish.catNovel')" value="小说" />
                    <el-option :label="$t('publish.catKaoyan')" value="考研" />
                    <el-option :label="$t('publish.catLiterature')" value="文学" />
                    <el-option :label="$t('publish.catOther')" value="其他" />
                  </el-select>
                </el-form-item>
                <el-form-item :label="$t('admin.suggestPrice')">
                  <el-input-number v-model="bookForm.price" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
                <el-form-item :label="$t('admin.originalPrice')">
                  <el-input-number v-model="bookForm.originalPrice" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
              </div>
              <el-form-item :label="$t('admin.bookDesc')">
                <el-input v-model="bookForm.description" type="textarea" :rows="4" :placeholder="$t('admin.bookDescPlaceholder')" />
              </el-form-item>
              <el-form-item :label="$t('admin.bookImages')">
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
              <el-button type="primary" :loading="bookSubmitting" @click="submitBook">{{ $t('admin.confirmSubmitBook') }}</el-button>
            </el-form>
          </div>
        </template>

        <!-- ===== 板块管理 ===== -->
        <template v-if="activeSection === 'boards'">
          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.boardManage') }}</h3>
              <el-button size="small" @click="loadBoards">{{ $t('common.refresh') }}</el-button>
            </div>
            <el-table :data="boardList" size="small">
              <el-table-column prop="id" label="ID" width="60" />
              <el-table-column :label="$t('admin.cover')" width="80">
                <template #default="{ row }">
                  <img v-if="row.bookCover" :src="row.bookCover" style="width:40px;height:55px;object-fit:cover;border-radius:4px" @error="$event.target.style.display='none'" />
                </template>
              </el-table-column>
              <el-table-column prop="bookTitle" :label="$t('admin.bookTitle')" min-width="150" />
              <el-table-column prop="bookAuthor" :label="$t('publish.author')" width="120" />
              <el-table-column prop="isbn" label="ISBN" width="140" />
              <el-table-column prop="edition" :label="$t('admin.edition')" width="80" />
              <el-table-column prop="productCount" :label="$t('admin.productCount')" width="80" />
              <el-table-column :label="$t('common.actions')" width="280" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="primary" @click="openBoardEdit(row)">{{ $t('admin.editInfo') }}</el-button>
                  <el-upload
                    :show-file-list="false"
                    accept="image/*"
                    :http-request="(opt) => uploadCover(row, opt)"
                    style="display:inline-block;margin-right:8px"
                  >
                    <el-button size="small" text type="primary">{{ $t('admin.uploadCover') }}</el-button>
                  </el-upload>
                  <el-button size="small" text type="danger" @click="deleteBoard(row)">{{ $t('admin.deleteBoard') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <!-- ===== 用户管理 ===== -->
        <template v-if="activeSection === 'users'">
          <div class="panel">
            <div class="panel-toolbar">
              <h3 class="panel-title">{{ $t('admin.userList') }}</h3>
              <el-input v-model="userKeyword" :placeholder="$t('admin.searchUserPlaceholder')" clearable style="width: 240px" @keyup.enter="loadUsers" @clear="loadUsers">
                <template #append><el-button @click="loadUsers">{{ $t('common.search') }}</el-button></template>
              </el-input>
            </div>
            <el-table :data="userList" size="small">
              <el-table-column prop="id" :label="$t('admin.id')" width="60" />
              <el-table-column :label="$t('admin.userNo')" width="100">
                <template #default="{ row }">
                  <span class="user-no-cell">{{ row.userNo || t('common.unassigned') }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="email" :label="$t('profile.email')" min-width="170" />
              <el-table-column prop="nickname" :label="$t('admin.nickname')" width="100" />
              <el-table-column prop="realName" :label="$t('admin.realName')" width="90" />
              <el-table-column prop="campus" :label="$t('admin.campus')" width="90" />
              <el-table-column :label="$t('admin.role')" width="100">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.role === 'admin' ? 'danger' : 'info'">{{ row.role === 'admin' ? t('common.admin') : t('common.user') }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.status')" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'banned' ? 'danger' : 'success'">{{ row.status === 'banned' ? t('common.banned') : t('common.normal') }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('common.actions')" width="280" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="primary" @click="openUserNoDialog(row)">{{ $t('admin.changeNo') }}</el-button>
                  <el-button size="small" text type="primary" @click="toggleRole(row)">{{ row.role === 'admin' ? t('common.unmakeAdmin') : t('common.makeAdmin') }}</el-button>
                  <el-button size="small" :type="row.status === 'banned' ? 'success' : 'danger'" plain @click="toggleBan(row)">
                    {{ row.status === 'banned' ? t('common.unban') : t('common.ban') }}
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

    <el-dialog v-model="showUserNoDialog" :title="$t('admin.changeNoTitle')" width="440px">
      <p class="user-no-tip">{{ $t('common.user') }}：{{ userNoForm.nickname }}（{{ $t('admin.currentIdPrefix') }}{{ userNoForm.oldNo }}）</p>
      <el-form label-position="top">
        <el-form-item :label="$t('admin.newNo')">
          <el-input v-model="userNoForm.newNo" :placeholder="$t('admin.newNoPlaceholder')" maxlength="8" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUserNoDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitUserNo">{{ $t('profile.confirmChange') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showBoardEditDialog" :title="$t('admin.editBoardTitle')" width="520px">
      <el-form :model="boardEditForm" label-position="top">
        <div class="form-grid">
          <el-form-item :label="$t('publish.bookTitle')">
            <el-input v-model="boardEditForm.bookTitle" :placeholder="$t('publish.placeholderTitle')" />
          </el-form-item>
          <el-form-item :label="$t('publish.author')">
            <el-input v-model="boardEditForm.bookAuthor" :placeholder="$t('publish.placeholderAuthor')" />
          </el-form-item>
          <el-form-item :label="$t('publish.publisher')">
            <el-input v-model="boardEditForm.bookPublisher" :placeholder="$t('publish.placeholderPublisher')" />
          </el-form-item>
          <el-form-item :label="$t('publish.edition')">
            <el-input v-model="boardEditForm.edition" :placeholder="$t('publish.editionPlaceholder')" />
          </el-form-item>
          <el-form-item label="ISBN">
            <el-input v-model="boardEditForm.isbn" :placeholder="$t('admin.isbnPlaceholder')" />
          </el-form-item>
          <el-form-item :label="$t('admin.originalPrice')">
            <el-input-number v-model="boardEditForm.originalPrice" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="showBoardEditDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="boardSaving" @click="submitBoardEdit">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>
   </div>
</template>

<script setup>import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  DataBoard, ChatDotRound, Bell, Reading, User, Back, Plus, Files
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { hotspotApi, notificationApi, adminApi } from '@/api'

const userStore = useUserStore()
const activeSection = ref('dashboard')
const stats = ref(null)

const statCards = computed(() => [
  { label: t('admin.statUsers'), value: stats.value?.userCount ?? '-', icon: User, color: 'linear-gradient(135deg,#5c6bc0,#3949ab)' },
  { label: t('admin.statProducts'), value: stats.value?.productCount ?? '-', icon: Reading, color: 'linear-gradient(135deg,#26a69a,#00897b)' },
  { label: t('admin.statOrders'), value: stats.value?.orderCount ?? '-', icon: DataBoard, color: 'linear-gradient(135deg,#ec407a,#d81b60)' },
  { label: t('admin.statHotspots'), value: stats.value?.hotspotCount ?? '-', icon: ChatDotRound, color: 'linear-gradient(135deg,#ffa726,#fb8c00)' },
  { label: t('admin.statBanned'), value: stats.value?.bannedCount ?? '-', icon: Bell, color: 'linear-gradient(135deg,#ef5350,#e53935)' }
])

const sectionTitle = computed(() => ({
  dashboard: t('admin.dashboard'),
  posts: t('admin.posts'),
  notifications: t('admin.notifications'),
  books: t('admin.books'),
  boards: t('admin.boards'),
  users: t('admin.users')
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
    ElMessage.success(t('admin.orderAdjusted'))
    loadPosts()
  } catch {}
}
async function removePost(row) {
  try {
    await ElMessageBox.confirm(t('admin.deletePostConfirm', { name: row.title }), t('common.hint'), { type: 'warning' })
    await hotspotApi.remove(row.id)
    ElMessage.success(t('common.deleted'))
    loadPosts()
  } catch {}
}
function switchSection(name) {
  activeSection.value = name
  if (name === 'posts') loadPosts()
  if (name === 'users') loadUsers()
  if (name === 'boards') loadBoards()
  if (name === 'notifications') loadNotifList()
}

/* ---- 板块管理 ---- */
const boardList = ref([])
async function loadBoards() {
  try {
    const res = await adminApi.listBoards()
    boardList.value = res.data || []
  } catch {}
}
async function deleteBoard(row) {
  try {
    await ElMessageBox.confirm(t('admin.deleteBoardConfirm', { name: row.bookTitle }), t('common.warning'), { type: 'warning' })
    await adminApi.deleteBoard(row.id)
    ElMessage.success(t('admin.boardDeleted'))
    loadBoards()
  } catch {}
}

async function uploadCover(row, opt) {
  try {
    const fd = new FormData()
    fd.append('cover', opt.file)
    const res = await adminApi.updateBoardCover(row.id, fd)
    ElMessage.success(t('admin.coverUpdated'))
    loadBoards()
  } catch {
    ElMessage.error(t('common.uploadFail'))
  }
}

/* ---- 通知管理 ---- */
const broadcastContent = ref('')
const singleUserId = ref(null)
const singleContent = ref('')
const userOptions = ref([])

async function broadcast() {
  if (!broadcastContent.value) {
    ElMessage.warning(t('admin.needNotifContent'))
    return
  }
  try {
    await notificationApi.broadcast(broadcastContent.value)
    ElMessage.success(t('admin.broadcastSent'))
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
    ElMessage.warning(t('admin.needSelectUser'))
    return
  }
  try {
    await notificationApi.sendToOne(singleUserId.value, singleContent.value)
    ElMessage.success(t('admin.notifSent'))
    singleContent.value = ''
    loadNotifList()
  } catch {}
}

const notifList = ref([])
async function loadNotifList() {
  try {
    const res = await adminApi.listNotifications()
    notifList.value = res.data || []
  } catch {}
}
async function deleteNotif(row) {
  try {
    await ElMessageBox.confirm(t('admin.deleteNotifConfirm'), t('common.warning'), { type: 'warning' })
    await adminApi.deleteNotification(row.id)
    ElMessage.success(t('admin.notifDeleted'))
    loadNotifList()
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
    ElMessage.warning(t('admin.needBookFields'))
    return
  }
  bookSubmitting.value = true
  try {
    const fd = new FormData()
    Object.entries(bookForm).forEach(([k, v]) => fd.append(k, v ?? ''))
    bookImages.value.forEach((img) => fd.append('images', img))
    await adminApi.createBook(fd)
    ElMessage.success(t('admin.bookAdded'))
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
    await ElMessageBox.confirm(ban ? t('admin.banConfirm', { name: row.nickname }) : t('admin.unbanConfirm', { name: row.nickname }), t('common.hint'), { type: 'warning' })
    await adminApi.updateUser(row.id, { status: ban ? 'banned' : 'active' })
    ElMessage.success(ban ? t('common.banned') : t('admin.unbanned'))
    loadUsers()
  } catch {}
}
async function toggleRole(row) {
  const makeAdmin = row.role !== 'admin'
  try {
    await ElMessageBox.confirm(makeAdmin ? t('admin.makeAdminConfirm', { name: row.nickname }) : t('admin.unmakeAdminConfirm', { name: row.nickname }), t('common.hint'), { type: 'warning' })
    await adminApi.updateUser(row.id, { role: makeAdmin ? 'admin' : 'user' })
    ElMessage.success(t('common.success'))
    if (row.id === userStore.userInfo?.id) {
      userStore.userInfo.role = makeAdmin ? 'admin' : 'user'
    }
    loadUsers()
  } catch {}
}

const showUserNoDialog = ref(false)
const userNoForm = ref({ id: null, nickname: '', oldNo: '', newNo: '' })

function openUserNoDialog(row) {
  userNoForm.value = { id: row.id, nickname: row.nickname, oldNo: row.userNo || t('common.unassigned'), newNo: row.userNo || '' }
  showUserNoDialog.value = true
}

async function submitUserNo() {
  const { id, newNo, oldNo } = userNoForm.value
  if (!newNo || !/^\d{8}$/.test(newNo)) {
    ElMessage.warning(t('admin.id8Digits'))
    return
  }
  if (newNo === oldNo) {
    ElMessage.warning(t('admin.idSame'))
    return
  }
  try {
    await adminApi.updateUserNo(id, newNo)
    ElMessage.success(t('admin.idChanged'))
    showUserNoDialog.value = false
    loadUsers()
  } catch {}
}

const showBoardEditDialog = ref(false)
const boardSaving = ref(false)
const boardEditForm = ref({ id: null, bookTitle: '', bookAuthor: '', bookPublisher: '', edition: '', isbn: '', originalPrice: 0 })

function openBoardEdit(row) {
  boardEditForm.value = {
    id: row.id,
    bookTitle: row.bookTitle || '',
    bookAuthor: row.bookAuthor || '',
    bookPublisher: row.bookPublisher || '',
    edition: row.edition || '',
    isbn: row.isbn || '',
    originalPrice: Number(row.originalPrice) || 0
  }
  showBoardEditDialog.value = true
}

async function submitBoardEdit() {
  const f = boardEditForm.value
  if (!f.bookTitle.trim()) {
    ElMessage.warning(t('admin.needBoardTitle'))
    return
  }
  boardSaving.value = true
  try {
    await adminApi.updateBoard(f.id, {
      bookTitle: f.bookTitle,
      bookAuthor: f.bookAuthor,
      bookPublisher: f.bookPublisher,
      edition: f.edition,
      isbn: f.isbn,
      originalPrice: f.originalPrice
    })
    ElMessage.success(t('admin.boardUpdated'))
    showBoardEditDialog.value = false
    loadBoards()
  } catch {} finally {
    boardSaving.value = false
  }
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
.user-no-cell {
  font-weight: 600;
  color: #42a5f5;
  letter-spacing: 1px;
}
.user-no-tip {
  margin-bottom: 16px;
  color: #607d8b;
  font-size: 14px;
}
</style>