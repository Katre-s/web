<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <h1 class="brand-name">文衡</h1>
        <p class="brand-slogan">文聚学府，百事通达</p>
      </div>
      <h2 class="login-title">{{ isLogin ? '登录' : '注册' }}</h2>
      <el-form :model="form" label-position="top" @submit.prevent="handleSubmit">
        <el-form-item>
          <el-input v-model="form.studentId" placeholder="学号" />
        </el-form-item>
        <el-form-item v-if="!isLogin">
          <el-input v-model="form.nickname" placeholder="昵称" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" show-password />
        </el-form-item>
        <el-button type="primary" round :loading="loading" @click="handleSubmit" style="width: 100%">
          {{ isLogin ? '登录' : '注册' }}
        </el-button>
      </el-form>
      <p class="toggle-text" @click="isLogin = !isLogin">
        {{ isLogin ? '没有账号？去注册' : '已有账号？去登录' }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

const isLogin = ref(true)
const loading = ref(false)
const form = ref({ studentId: '', nickname: '', password: '' })

async function handleSubmit() {
  if (!form.value.studentId || !form.value.password) {
    ElMessage.warning('请填写学号和密码')
    return
  }
  loading.value = true
  try {
    if (isLogin.value) {
      await userStore.login(form.value.studentId, form.value.password)
    } else {
      if (!form.value.nickname) {
        ElMessage.warning('请填写昵称')
        return
      }
      await userStore.register(form.value.studentId, form.value.password, form.value.nickname)
    }
    ElMessage.success(isLogin.value ? '登录成功' : '注册成功')
    router.push(route.query.redirect || '/')
  } catch {
    // 错误已在拦截器处理
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 60px);
}
.login-card {
  background: #fff;
  border-radius: 20px;
  padding: 40px 36px;
  width: 360px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
}
.login-title {
  text-align: center;
  margin-bottom: 28px;
  color: #1a1a1a;
}
.brand {
  text-align: center;
  margin-bottom: 24px;
}
.brand-name {
  font-size: 32px;
  color: #4caf50;
  letter-spacing: 4px;
}
.brand-slogan {
  font-size: 13px;
  color: #999;
  margin-top: 6px;
  letter-spacing: 2px;
}
.toggle-text {
  text-align: center;
  margin-top: 16px;
  color: #4caf50;
  cursor: pointer;
  font-size: 14px;
}
</style>