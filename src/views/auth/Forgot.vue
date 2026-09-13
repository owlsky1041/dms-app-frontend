<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="logo">
        <el-icon :size="44" color="#409eff"><Files /></el-icon>
        <h1>{{ siteStore.siteName }}</h1>
        <p class="sub">找回密码</p>
      </div>

      <el-alert
        v-if="!siteStore.passwordResetAvailable"
        type="warning"
        :closable="false"
        show-icon
        title="系统当前未开放自助找回密码"
        description="请联系管理员重置密码。"
        style="margin-bottom: 18px"
      />

      <el-form v-else ref="formRef" :model="form" :rules="rules" label-position="top" size="large">
        <el-form-item label="账号或邮箱" prop="account">
          <el-input
            v-model="form.account"
            placeholder="请输入登录账号或已绑定的邮箱"
            :prefix-icon="User"
            clearable
            :disabled="codeSent"
          >
            <template #append>
              <el-button :loading="sending" :disabled="codeSent && countdown > 0" @click="handleSendCode">
                {{ codeSent && countdown > 0 ? `${countdown} 秒后重发` : '获取验证码' }}
              </el-button>
            </template>
          </el-input>
          <div v-if="sentTip" class="tip">{{ sentTip }}</div>
        </el-form-item>

        <el-form-item label="邮件验证码" prop="code">
          <el-input v-model="form.code" placeholder="6 位数字验证码" :prefix-icon="Key" maxlength="6" clearable />
        </el-form-item>

        <el-form-item label="新密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="6-30 位" :prefix-icon="Lock" show-password />
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="再次输入新密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="handleReset"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" class="submit-btn" :loading="loading" @click="handleReset">
            重置密码
          </el-button>
        </el-form-item>
      </el-form>

      <div class="auth-links">
        <el-link type="primary" :underline="false" @click="goLogin">返回登录</el-link>
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
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock, Files, Key } from '@element-plus/icons-vue'
import { sendResetCode, resetPasswordByCode } from '@/api/site'
import { useSiteStore } from '@/stores/site'

const router = useRouter()
const siteStore = useSiteStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const sending = ref(false)
const codeSent = ref(false)
const sentTip = ref('')
const countdown = ref(0)
let timer: number | undefined

const form = reactive({
  account: '',
  code: '',
  password: '',
  confirmPassword: ''
})

const rules: FormRules = {
  account: [{ required: true, message: '请输入账号或邮箱', trigger: 'blur' }],
  code: [
    { required: true, message: '请输入邮件验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为 6 位数字', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 30, message: '密码长度需为 6-30 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur'
    }
  ]
}

function startCountdown(seconds: number) {
  countdown.value = seconds
  window.clearInterval(timer)
  timer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) window.clearInterval(timer)
  }, 1000)
}

async function handleSendCode() {
  const account = form.account.trim()
  if (!account) {
    ElMessage.warning('请先输入账号或邮箱')
    return
  }
  sending.value = true
  try {
    const res = await sendResetCode(account)
    codeSent.value = true
    sentTip.value = res?.message || `验证码已发送至 ${res?.maskedEmail || '绑定邮箱'}`
    // 后端 60 秒内只允许发一次，前端同步倒计时避免用户白点
    startCountdown(60)
    ElMessage.success('验证码已发送，请查收邮件')
  } catch {
    // 错误提示由 http 拦截器统一弹出
  } finally {
    sending.value = false
  }
}

async function handleReset() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await resetPasswordByCode({
      account: form.account.trim(),
      code: form.code.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword
    })
    ElMessage.success('密码已重置，请使用新密码登录')
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

onUnmounted(() => window.clearInterval(timer))
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

  .tip {
    color: #909399;
    font-size: 12px;
    line-height: 1.6;
    margin-top: 4px;
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
