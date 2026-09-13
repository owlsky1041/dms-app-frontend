<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="logo">
        <el-icon :size="44" color="#409eff"><Files /></el-icon>
        <h1>{{ siteStore.siteName }}</h1>
        <p class="sub">注册新账号</p>
      </div>

      <el-alert
        v-if="!siteStore.registerEnabled"
        type="warning"
        :closable="false"
        show-icon
        title="系统当前未开放自助注册"
        description="请联系管理员开通账号。"
        style="margin-bottom: 18px"
      />

      <el-form v-else ref="formRef" :model="form" :rules="rules" label-position="top" size="large">
        <el-form-item label="登录账号" prop="username">
          <el-input v-model="form.username" placeholder="2-30 位，字母/数字/下划线/中文" :prefix-icon="User" clearable />
        </el-form-item>
        <el-form-item label="姓名" prop="nickName">
          <el-input v-model="form.nickName" placeholder="留空则与账号相同" :prefix-icon="Postcard" clearable />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="6-30 位" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="再次输入密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="handleRegister"
          />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="用于忘记密码时接收验证码，建议填写" :prefix-icon="Message" clearable />
        </el-form-item>
        <el-form-item label="手机号" prop="phoneNumber">
          <el-input v-model="form.phoneNumber" placeholder="选填" :prefix-icon="Iphone" clearable />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" class="submit-btn" :loading="loading" @click="handleRegister">
            注 册
          </el-button>
        </el-form-item>
      </el-form>

      <div class="auth-links">
        <el-link type="primary" :underline="false" @click="goLogin">已有账号？返回登录</el-link>
      </div>
    </div>

    <div v-if="siteStore.icp || siteStore.copyright" class="auth-footer">
      <span v-if="siteStore.icp">{{ siteStore.icp }}</span>
      <span v-if="siteStore.icp && siteStore.copyright" class="sep">|</span>
      <span v-if="siteStore.copyright">{{ siteStore.copyright }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock, Files, Message, Iphone, Postcard } from '@element-plus/icons-vue'
import { siteRegister } from '@/api/site'
import { useSiteStore } from '@/stores/site'

const router = useRouter()
const siteStore = useSiteStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  username: '',
  nickName: '',
  password: '',
  confirmPassword: '',
  email: '',
  phoneNumber: ''
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入登录账号', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_\u4e00-\u9fa5]{2,30}$/, message: '账号只能包含字母、数字、下划线或中文，长度 2-30 位', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 30, message: '密码长度需为 6-30 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur'
    }
  ],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
  phoneNumber: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }]
}

async function handleRegister() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await siteRegister({
      username: form.username.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword,
      nickName: form.nickName.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim()
    })
    ElMessage.success('注册成功，请登录')
    router.replace({ name: 'Login' })
  } catch {
    // 错误提示由 http 拦截器统一弹出
  } finally {
    loading.value = false
  }
}

function goLogin() {
  router.replace({ name: 'Login' })
}

onMounted(() => {
  if (!siteStore.loaded) siteStore.load()
})
</script>

<style lang="scss" scoped>
.auth-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: linear-gradient(135deg, #1f3a5f 0%, #2d5a8a 50%, #409eff 100%);
}

.auth-card {
  width: 440px;
  padding: 36px 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);

  .logo {
    text-align: center;
    margin-bottom: 20px;

    h1 {
      font-size: 20px;
      color: #303133;
      margin: 10px 0 0;
    }
    .sub {
      margin: 4px 0 0;
      font-size: 13px;
      color: #909399;
    }
  }

  .submit-btn {
    width: 100%;
  }
}

.auth-links {
  display: flex;
  justify-content: center;
  margin-top: 6px;
}

.auth-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 20px;
  padding: 0 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  line-height: 1.8;

  .sep {
    margin: 0 8px;
    color: rgba(255, 255, 255, 0.35);
  }
}
</style>
