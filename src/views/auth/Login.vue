<template>
  <div class="login-page">
    <div class="login-card">
      <div class="logo">
        <el-icon :size="48" color="#409eff"><Files /></el-icon>
        <h1>DMS 文档管理系统</h1>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" size="large">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            :prefix-icon="User"
            clearable
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="login-btn" :loading="loading" @click="handleLogin">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
      <p class="tip">默认账号：admin / admin123</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock, Files } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { login, getUserInfo } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  username: 'admin',
  password: 'admin123'
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const res = await login(form.username, form.password)
    // 取真实用户信息（userId 用于上传隔离 ownerKey）
    // 注意：雪花 ID 超出 JS 安全整数范围，必须保持字符串，不能 Number()
    let realUserId = ''
    let nickname = form.username
    try {
      const info = await getUserInfo()
      const u = info?.user || {} as any
      realUserId = String(u.userId || '')
      nickname = u.nickName || u.userName || form.username
    } catch (e) {
      console.warn('获取用户信息失败，使用默认值', e)
    }
    userStore.setUser({
      token: res.access_token,
      userId: realUserId,
      username: form.username,
      nickname,
      roleIds: [],
      deptIds: []
    })
    ElMessage.success('登录成功')
    router.push((route.query.redirect as string) || '/')
  } catch (e) {
    // 错误提示由 http 拦截器统一弹出
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f3a5f 0%, #2d5a8a 50%, #409eff 100%);
}

.login-card {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);

  .logo {
    text-align: center;
    margin-bottom: 24px;

    h1 {
      font-size: 20px;
      color: #303133;
      margin: 12px 0 0;
    }
  }

  .login-btn {
    width: 100%;
  }

  .tip {
    text-align: center;
    color: #909399;
    font-size: 12px;
    margin-top: 8px;
  }
}
</style>
