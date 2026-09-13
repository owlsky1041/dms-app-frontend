<template>
  <div class="login-page">
    <div class="login-card">
      <div class="logo">
        <!-- 标识图可在「站点配置」里换；没配就退回默认图标，不让页面开天窗 -->
        <img v-if="siteStore.logoUrl" class="logo-img" :src="siteStore.logoUrl" :alt="siteStore.siteName" />
        <el-icon v-else :size="48" color="#409eff"><Files /></el-icon>
        <h1>{{ siteStore.siteName }}</h1>
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
      <div class="login-links">
        <el-link v-if="siteStore.registerEnabled" type="primary" :underline="false" @click="goRegister">
          注册账号
        </el-link>
        <span v-if="siteStore.registerEnabled && siteStore.passwordResetAvailable" class="divider">|</span>
        <el-link
          v-if="siteStore.passwordResetAvailable"
          type="primary"
          :underline="false"
          @click="goForgot"
        >
          忘记密码？
        </el-link>
      </div>
    </div>
    <div class="login-footer" v-if="siteStore.icp || siteStore.copyright">
      <span v-if="siteStore.icp">{{ siteStore.icp }}</span>
      <span v-if="siteStore.icp && siteStore.copyright" class="sep">|</span>
      <span v-if="siteStore.copyright">{{ siteStore.copyright }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock, Files } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useSiteStore } from '@/stores/site'
import { login, getUserInfo } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const siteStore = useSiteStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
// 不预填任何账号：以前预填 admin/admin123 并在页面写着默认口令，
// 等于把管理入口的凭据公开贴在登录页上，生产环境必须清掉
const form = reactive({
  username: '',
  password: ''
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

    // 必须先落 token，再取用户信息：
    // http 拦截器是从 store 里读 token 拼 Authorization 头的，
    // 顺序反了这次请求就是匿名的（401），roles/permissions 拿不到，
    // 表现就是「登录后系统管理菜单不见了、刷新一下又出来」。
    userStore.setUser({
      token: res.access_token,
      userId: '',
      username: form.username,
      nickname: form.username,
      roleIds: [],
      deptIds: [],
      roles: [],
      permissions: []
    })

    // 取真实用户信息（userId 用于上传隔离 ownerKey；roles/permissions 决定菜单可见性）
    // 注意：雪花 ID 超出 JS 安全整数范围，必须保持字符串，不能 Number()
    try {
      userStore.applyProfile(await getUserInfo())
    } catch (e) {
      console.warn('[DMS] 登录后获取用户信息失败', e)
      ElMessage({
        type: 'warning',
        duration: 0,
        showClose: true,
        message: '已登录，但未取到权限信息，菜单可能显示不全；请刷新页面或重新登录'
      })
    }

    ElMessage.success('登录成功')
    router.push((route.query.redirect as string) || '/')
  } catch (e) {
    // 错误提示由 http 拦截器统一弹出
  } finally {
    loading.value = false
  }
}

function goRegister() {
  router.push({ name: 'Register' })
}

function goForgot() {
  router.push({ name: 'Forgot' })
}
</script>

<style lang="scss" scoped>
/* 备案/版权：固定在页面底部居中（原先作为 flex 子项被排到了卡片右侧） */
.login-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 20px;
  padding: 0 16px;
  text-align: center;
  /* 深色渐变背景上使用浅色文字，保证可读性 */
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  line-height: 1.8;

  .sep {
    margin: 0 8px;
    color: rgba(255, 255, 255, 0.35);
  }
}

.login-page {
  position: relative;
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

    /* 标识图：无论上传的是 32×32 还是 512×512，都按 64px 等比放进方框，
       否则一张大图会把登录卡片撑变形 */
    .logo-img {
      width: 64px;
      height: 64px;
      object-fit: contain;
      display: inline-block;
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

/* 注册 / 忘记密码入口：靠右对齐 */
.login-links {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: -4px;
  font-size: 13px;

  .divider {
    color: #dcdfe6;
  }
}
</style>
