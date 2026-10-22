<template>
  <div class="plaza-page">
    <!-- 顶部 -->
    <header class="plaza-hero">
      <div class="hero-text">
        <h1>{{ $t('plaza.title') }}</h1>
        <p>{{ $t('plaza.subtitle') }}</p>
      </div>
      <div class="hero-fish"><BrandLogo :size="92" /></div>
      <span class="hero-bubble b1"></span>
      <span class="hero-bubble b2"></span>
      <span class="hero-bubble b3"></span>
    </header>

    <!-- 发布框 -->
    <section class="composer">
      <div class="composer-row">
        <img class="avatar" :src="myAvatar" @error="avatarFallback" />
        <div class="composer-main">
          <el-input
            v-model="content"
            type="textarea"
            :rows="3"
            maxlength="500"
            resize="none"
            :placeholder="$t('plaza.placeholder')"
            class="composer-input"
          />
          <div class="previews" v-if="previews.length">
            <div v-for="(p, i) in previews" :key="p.id" class="preview">
              <img :src="p.url" />
              <button class="preview-remove" type="button" @click="removeImage(i)">×</button>
            </div>
          </div>
          <div class="composer-actions">
            <button class="image-btn" type="button" :disabled="previews.length >= MAX_IMAGES" @click="fileInput?.click()">
              🖼 {{ $t('plaza.addImage') }}
              <em>{{ previews.length }}/{{ MAX_IMAGES }}</em>
            </button>
            <span class="char-count">{{ $t('plaza.charCount', { n: content.length }) }}</span>
            <button class="post-btn" type="button" :disabled="!canPost || posting" @click="submit">
              {{ posting ? $t('plaza.publishing') : $t('plaza.publish') }}
            </button>
          </div>
          <input ref="fileInput" type="file" accept="image/*" multiple style="display: none" @change="onFiles" />
        </div>
      </div>
    </section>

    <!-- 动态列表 -->
    <section class="feed" v-loading="loading">
      <article v-for="post in list" :key="post.id" class="post-card">
        <header class="post-head">
          <img class="avatar" :src="resolveImg(post.author?.avatar) || defaultAvatar" @error="avatarFallback" />
          <div class="who">
            <b>{{ post.author?.nickname || $t('plaza.authorFallback') }}</b>
            <span>
              <template v-if="post.author?.campus">{{ post.author.campus }} · </template>
              {{ formatTime(post.created_at || post.createdAt) }}
            </span>
          </div>
          <button v-if="post.userId === me?.id" class="del-btn" type="button" @click="removePost(post)">
            {{ $t('common.delete') }}
          </button>
        </header>

        <p class="post-text" v-if="post.content">{{ post.content }}</p>

        <div class="post-images" :class="`n${Math.min(post.images.length, 3)}`" v-if="post.images && post.images.length">
          <el-image
            v-for="(img, i) in post.images"
            :key="i"
            :src="resolveImg(img)"
            :preview-src-list="post.images.map(resolveImg)"
            :initial-index="i"
            fit="cover"
            preview-teleported
            class="post-img"
          />
        </div>
      </article>

      <el-empty v-if="!loading && !list.length" :description="$t('plaza.empty')" />
      <div class="feed-foot" v-if="list.length">
        <el-button v-if="hasMore" text :loading="loadingMore" @click="loadMore">{{ $t('plaza.loadMore') }}</el-button>
        <span v-else class="no-more">{{ $t('plaza.noMore') }}</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus/es/components/message/index'
import { ElMessageBox } from 'element-plus/es/components/message-box/index'
import { useUserStore } from '@/stores/user'
import { plazaApi } from '@/api'
import { resolveImg } from '@/utils/image'
import BrandLogo from '@/components/BrandLogo.vue'

const { t } = useI18n()
const userStore = useUserStore()
const me = computed(() => userStore.userInfo)

const MAX_IMAGES = 6
const MAX_SIZE = 10 * 1024 * 1024

const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const loading = ref(false)
const loadingMore = ref(false)
const posting = ref(false)

const content = ref('')
const previews = ref([])
const fileInput = ref(null)

const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="%2310667a"/><text x="50%" y="50%" fill="%23fff" text-anchor="middle" dy=".35em" font-size="15">鱼</text></svg>'
const myAvatar = computed(() => resolveImg(me.value?.avatar) || defaultAvatar)

const canPost = computed(() => content.value.trim().length > 0 || previews.value.length > 0)
const hasMore = computed(() => list.value.length < total.value)

function avatarFallback(e) {
  if (e?.target) e.target.src = defaultAvatar
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return t('plaza.justNow')
  if (diff < 3600) return `${Math.floor(diff / 60)}${t('plaza.minutesAgo')}`
  if (diff < 86400) return `${Math.floor(diff / 3600)}${t('plaza.hoursAgo')}`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}${t('plaza.daysAgo')}`
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function onFiles(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  for (const f of files) {
    if (previews.value.length >= MAX_IMAGES) {
      ElMessage.warning(t('plaza.imagesLimit', { n: MAX_IMAGES }))
      break
    }
    if (f.size > MAX_SIZE) {
      ElMessage.warning(t('plaza.imageTooLarge'))
      continue
    }
    previews.value.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, file: f, url: URL.createObjectURL(f) })
  }
}

function removeImage(i) {
  const item = previews.value[i]
  if (item?.url) URL.revokeObjectURL(item.url)
  previews.value.splice(i, 1)
}

function clearPreviews() {
  previews.value.forEach((p) => URL.revokeObjectURL(p.url))
  previews.value = []
}

async function loadPage(targetPage = 1, append = false) {
  if (append) loadingMore.value = true
  else loading.value = true
  try {
    const res = await plazaApi.list({ page: targetPage, pageSize })
    const data = res.data || {}
    const rows = data.list || []
    total.value = Number(data.total) || 0
    page.value = targetPage
    list.value = append ? list.value.concat(rows) : rows
  } catch {
    if (!append) list.value = []
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function loadMore() {
  loadPage(page.value + 1, true)
}

async function submit() {
  if (!canPost.value || posting.value) return
  posting.value = true
  try {
    const fd = new FormData()
    fd.append('content', content.value.trim())
    previews.value.forEach((p) => fd.append('images', p.file))
    await plazaApi.create(fd)
    ElMessage.success(t('plaza.publishSuccess'))
    content.value = ''
    clearPreviews()
    await loadPage(1)
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || t('plaza.publishFail'))
  } finally {
    posting.value = false
  }
}

async function removePost(post) {
  try {
    await ElMessageBox.confirm(t('plaza.deleteConfirm'), t('common.warning'), { type: 'warning' })
    await plazaApi.remove(post.id)
    ElMessage.success(t('plaza.deleted'))
    list.value = list.value.filter((p) => p.id !== post.id)
    total.value = Math.max(total.value - 1, 0)
  } catch {
    // 取消或失败：失败时 interceptor 已提示
  }
}

onMounted(() => loadPage(1))
onUnmounted(clearPreviews)
</script>

<style scoped>
.plaza-page {
  max-width: 820px;
  margin: 0 auto;
  padding-bottom: 24px;
}

/* ---------------- 顶部 ---------------- */
.plaza-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 26px 30px;
  margin-bottom: 18px;
  border-radius: 22px;
  color: #f4fbfa;
  background:
    radial-gradient(70% 120% at 100% 0%, rgba(255, 154, 90, 0.32), transparent 60%),
    linear-gradient(120deg, #0b2f3f 0%, #0e4f61 60%, #126f7e 100%);
  box-shadow: 0 20px 40px -28px rgba(11, 47, 63, 0.9);
}
.hero-text h1 {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 1px;
}
.hero-text p {
  margin-top: 6px;
  font-size: 12.5px;
  color: rgba(244, 251, 250, 0.66);
}
.hero-fish {
  opacity: 0.95;
  animation: fish-float 7s ease-in-out infinite;
}
@keyframes fish-float {
  0%, 100% { transform: translateY(0) rotate(-4deg); }
  50% { transform: translateY(-8px) rotate(4deg); }
}
.hero-bubble {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.08) 70%);
  pointer-events: none;
}
.hero-bubble.b1 { width: 42px; height: 42px; right: 28%; top: 18%; opacity: 0.5; }
.hero-bubble.b2 { width: 16px; height: 16px; right: 22%; top: 56%; opacity: 0.45; }
.hero-bubble.b3 { width: 24px; height: 24px; left: 44%; bottom: 14%; opacity: 0.3; }

/* ---------------- 发布框 ---------------- */
.composer {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: var(--card-shadow);
}
.composer-row {
  display: flex;
  gap: 12px;
}
.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #e7f3f4;
}
.composer-main {
  flex: 1;
  min-width: 0;
}
.composer-input :deep(.el-textarea__inner) {
  border-radius: 12px;
  background: rgba(26, 144, 160, 0.04);
  box-shadow: 0 0 0 1px rgba(26, 144, 160, 0.12) inset;
  font-size: 14px;
  padding: 10px 12px;
  color: var(--text-main);
}
.composer-input :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1.5px #1a90a0 inset;
  background: #fff;
}
.composer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}
.image-btn {
  border: 0;
  background: rgba(26, 144, 160, 0.08);
  color: #137c88;
  font-family: inherit;
  font-size: 12.5px;
  padding: 7px 12px;
  border-radius: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s;
}
.image-btn:hover:not(:disabled) {
  background: rgba(26, 144, 160, 0.16);
}
.image-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.image-btn em {
  font-style: normal;
  font-size: 11px;
  color: #7fa3ab;
}
.char-count {
  margin-left: auto;
  font-size: 11px;
  color: #a9bfc6;
}
.post-btn {
  border: 0;
  height: 36px;
  padding: 0 20px;
  border-radius: 11px;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #0e5568, #1a90a0);
  cursor: pointer;
  transition: all 0.22s;
  box-shadow: 0 10px 20px -12px rgba(16, 102, 122, 0.8);
}
.post-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.post-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.previews {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.preview {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 10px;
  overflow: hidden;
  background: #f0f5f6;
}
.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.preview-remove {
  position: absolute;
  right: 3px;
  top: 3px;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---------------- 动态 ---------------- */
.feed {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 120px;
}
.post-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--card-shadow);
  transition: box-shadow 0.25s ease;
}
.post-card:hover {
  box-shadow: var(--card-shadow-hover);
}
.post-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.post-head .avatar {
  width: 38px;
  height: 38px;
}
.who {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
  min-width: 0;
}
.who b {
  font-size: 13.5px;
  color: var(--text-main);
}
.who span {
  font-size: 11px;
  color: #9db2ba;
}
.del-btn {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: #b0bec5;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 8px;
  transition: all 0.2s;
}
.del-btn:hover {
  color: #e5484d;
  background: rgba(229, 72, 77, 0.08);
}
.post-text {
  margin: 10px 2px 0;
  font-size: 14.5px;
  line-height: 1.75;
  color: var(--text-main);
  white-space: pre-wrap;
  word-break: break-word;
}
.post-images {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}
.post-images.n1 {
  grid-template-columns: minmax(0, 1fr);
  max-width: 340px;
}
.post-images.n1 .post-img {
  aspect-ratio: 4 / 3;
}
.post-images.n2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: 460px;
}
.post-images.n3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.post-images.n2 .post-img,
.post-images.n3 .post-img {
  aspect-ratio: 1 / 1;
}
.post-img {
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  cursor: zoom-in;
  background: #eef4f5;
}
.feed-foot {
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
}
.no-more {
  font-size: 11.5px;
  color: #b0bec5;
}

@media (max-width: 768px) {
  .plaza-hero {
    padding: 20px;
    border-radius: 18px;
  }
  .hero-text h1 {
    font-size: 20px;
  }
  .hero-text p {
    font-size: 11.5px;
  }
  .hero-fish :deep(svg) {
    width: 66px !important;
    height: 66px !important;
  }
  .composer {
    padding: 13px;
    border-radius: 16px;
  }
  .composer-row {
    gap: 9px;
  }
  .composer-actions {
    gap: 8px;
    flex-wrap: wrap;
  }
  .char-count {
    order: 3;
    width: 100%;
    margin-left: 0;
  }
  .post-btn {
    margin-left: auto;
  }
  .post-card {
    padding: 13px;
    border-radius: 16px;
  }
  .post-text {
    font-size: 14px;
  }
}
</style>
