<template>
  <div class="sys-page">
    <div class="page-scroll" v-loading="loading">
    <div class="page-header">
      <h3>站点配置</h3>
      <span class="hint">站点名称、站点标识图与标签页图标、登录页备案版权、用户自助注册、密码找回、邮件（SMTP）配置</span>
    </div>

    <el-form :model="form" label-width="120px" style="max-width: 720px">
      <!-- ==================== 基础信息 ==================== -->
      <div class="section-title">基础信息</div>

      <el-form-item label="站点名称" required>
        <el-input v-model="form.siteName" maxlength="50" show-word-limit placeholder="例如：文档管理系统" />
        <div class="tip">用于浏览器标签标题、系统页头与登录页标题</div>
      </el-form-item>

      <el-form-item label="备案信息">
        <el-input v-model="form.icp" maxlength="120" placeholder="例如：浙ICP备2026000000号" />
        <div class="tip">显示在登录页底部，留空则不显示</div>
      </el-form-item>

      <el-form-item label="版权信息">
        <el-input v-model="form.copyright" maxlength="120" placeholder="例如：© 2026 某某公司 版权所有" />
        <div class="tip">显示在登录页底部，留空则不显示</div>
      </el-form-item>

      <el-form-item label="站点标识图">
        <div class="favicon-row">
          <div class="favicon-preview logo">
            <img v-if="logoPreviewUrl" :src="logoPreviewUrl" alt="站点标识图" />
            <el-icon v-else :size="34"><Files /></el-icon>
          </div>
          <div class="favicon-actions">
            <input ref="logoInputRef" type="file" accept=".png,.svg,.jpg,.jpeg,.gif,.webp" style="display:none" @change="onPickLogo" />
            <el-button size="small" @click="logoInputRef?.click()">选择图片</el-button>
            <span class="tip">
              显示在登录页标题上方与登录后左上角。建议正方形、128×128 以上；
              支持 png / svg / jpg / gif / webp。留空则用默认图标。
            </span>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="标签页图标">
        <div class="favicon-row">
          <div class="favicon-preview">
            <img v-if="previewUrl" :src="previewUrl" alt="标签页图标" />
            <el-icon v-else :size="26"><Picture /></el-icon>
          </div>
          <div class="favicon-actions">
            <input ref="fileInputRef" type="file" accept=".ico,.png,.svg,.jpg,.jpeg,.gif,.webp" style="display:none" @change="onPick" />
            <el-button size="small" @click="fileInputRef?.click()">选择图标</el-button>
            <span class="tip">浏览器标签页上的小图标，支持 ico / png / svg / jpg / gif / webp，建议正方形（如 64×64）</span>
          </div>
        </div>
      </el-form-item>

      <!-- ==================== 用户自助注册 ==================== -->
      <div class="section-title">用户自助注册</div>

      <el-form-item label="开放注册">
        <el-switch v-model="form.registerEnabled" />
        <div class="tip">
          开启后登录页会出现「注册账号」入口，任何人可自行创建账号。
          新账号默认没有任何文档权限，需管理员在「用户管理」中分配角色或授权。
        </div>
      </el-form-item>

      <el-form-item label="默认角色">
        <el-select
          v-model="selectedRoleIds"
          multiple
          filterable
          clearable
          collapse-tags
          collapse-tags-tooltip
          placeholder="留空则注册后不授角色"
          style="width: 100%"
        >
          <el-option
            v-for="r in roleOptions"
            :key="String(r.roleId)"
            :label="`${r.roleName}（${r.roleKey}）`"
            :value="String(r.roleId)"
          />
        </el-select>
        <div class="tip">注册成功后自动赋予这些角色；不确定就留空，由管理员人工分配更安全</div>
      </el-form-item>

      <!-- ==================== 密码找回 ==================== -->
      <div class="section-title">密码找回</div>

      <el-form-item label="邮箱找回密码">
        <el-switch v-model="form.resetEnabled" :disabled="!form.mailEnabled" />
        <div class="tip">
          开启后登录页会出现「忘记密码？」入口：用户输入账号或邮箱，系统向其绑定邮箱发送 6 位验证码，
          验证通过后即可自行设置新密码（验证码 5 分钟有效，同账号 60 秒内只能发一次）。
          <span v-if="!form.mailEnabled" class="warn">需先启用并保存下方的邮件配置。</span>
        </div>
      </el-form-item>

      <!-- ==================== 邮件配置 ==================== -->
      <div class="section-title">邮件（SMTP）配置</div>

      <el-form-item label="启用邮件">
        <el-switch v-model="form.mailEnabled" />
        <div class="tip">用于发送密码找回验证码与配置测试邮件；关闭后「邮箱找回密码」自动不可用</div>
      </el-form-item>

      <el-form-item label="SMTP 服务器">
        <el-input v-model="form.mailHost" placeholder="例如：smtp.exmail.qq.com / 192.168.9.10" />
      </el-form-item>

      <el-form-item label="端口">
        <el-input-number v-model="form.mailPort" :min="1" :max="65535" :controls="false" style="width: 140px" />
        <span class="tip inline">SSL 通常 465，STARTTLS 通常 587，明文通常 25</span>
      </el-form-item>

      <el-form-item label="加密方式">
        <el-radio-group v-model="form.mailEncrypt">
          <el-radio value="ssl">SSL</el-radio>
          <el-radio value="starttls">STARTTLS</el-radio>
          <el-radio value="none">不加密</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="登录账号">
        <el-input v-model="form.mailUsername" placeholder="通常是完整邮箱地址" autocomplete="off" />
      </el-form-item>

      <el-form-item label="登录密码">
        <el-input
          v-model="form.mailPassword"
          type="password"
          show-password
          autocomplete="new-password"
          :placeholder="mailPasswordSet ? '已设置，留空表示不修改' : '邮箱密码或 SMTP 授权码'"
        />
        <div class="tip">多数邮箱需使用「SMTP 授权码」而非登录密码；出于安全，此处不会回显已保存的密码</div>
      </el-form-item>

      <el-form-item label="发件邮箱">
        <el-input v-model="form.mailFrom" placeholder="例如：dms@company.com" />
        <div class="tip">实际发信地址；部分邮箱要求与登录账号一致</div>
      </el-form-item>

      <el-form-item label="发件人名称">
        <el-input v-model="form.mailFromName" maxlength="50" placeholder="例如：DMS 文档系统" />
        <div class="tip">收件人看到的发件人显示名，留空则只显示邮箱</div>
      </el-form-item>

      <el-form-item label="测试收件人">
        <div class="test-row">
          <el-input v-model="testTo" placeholder="填写一个邮箱，保存配置后点右侧按钮验证" style="width: 320px" />
          <el-button :loading="testing" @click="handleTestMail">发送测试邮件</el-button>
        </div>
        <div class="tip">测试使用「已保存」的配置，请先保存再测试</div>
      </el-form-item>

      <!-- ==================== 操作 ==================== -->
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        <el-button @click="load">重置</el-button>
      </el-form-item>
    </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Picture, Files } from '@element-plus/icons-vue'
import {
  getSiteAdminConfig,
  updateSiteConfig,
  uploadSiteFavicon,
  testSiteMail
} from '@/api/site'
import { listSysRoles } from '@/api/system'
import { useSiteStore } from '@/stores/site'

const siteStore = useSiteStore()
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const logoInputRef = ref<HTMLInputElement | null>(null)
/** 本地新选图标的预览（blob URL），未选时用服务端的 */
const localPreview = ref('')
/** 同上，用于站点标识图 */
const localLogoPreview = ref('')
/** 是否已保存过 SMTP 密码（后端只返回这个布尔值，不回传明文） */
const mailPasswordSet = ref(false)
const testTo = ref('')
/** 角色下拉选项，roleId 保持字符串（雪花 ID 超出 JS 安全整数范围） */
const roleOptions = ref<any[]>([])
/** 默认角色以数组承载，保存时再拼成逗号分隔字符串 */
const selectedRoleIds = ref<string[]>([])

const form = reactive({
  siteName: 'DMS 文档管理',
  icp: '',
  copyright: '',
  registerEnabled: false,
  resetEnabled: false,
  mailEnabled: false,
  mailHost: '',
  mailPort: 465,
  mailEncrypt: 'ssl' as 'ssl' | 'starttls' | 'none',
  mailUsername: '',
  mailPassword: '',
  mailFrom: '',
  mailFromName: ''
})

const previewUrl = computed(() => localPreview.value || siteStore.faviconUrl || '')
const logoPreviewUrl = computed(() => localLogoPreview.value || siteStore.logoUrl || '')

function applyConfig(cfg: any) {
  form.siteName = cfg.siteName || 'DMS 文档管理'
  form.icp = cfg.icp || ''
  form.copyright = cfg.copyright || ''
  form.registerEnabled = !!cfg.registerEnabled
  form.resetEnabled = !!cfg.resetEnabled
  form.mailEnabled = !!cfg.mailEnabled
  form.mailHost = cfg.mailHost || ''
  form.mailPort = cfg.mailPort || 465
  form.mailEncrypt = (cfg.mailEncrypt as any) || 'ssl'
  form.mailUsername = cfg.mailUsername || ''
  form.mailFrom = cfg.mailFrom || ''
  form.mailFromName = cfg.mailFromName || ''
  // 密码不回显；留空提交时后端保持原值
  form.mailPassword = ''
  mailPasswordSet.value = !!cfg.mailPasswordSet
  selectedRoleIds.value = String(cfg.registerRoleIds || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function load() {
  loading.value = true
  try {
    const cfg = await getSiteAdminConfig()
    applyConfig(cfg)
    // 同步到全局 store：页头/标题/登录页入口立即生效
    siteStore.siteName = form.siteName
    siteStore.icp = form.icp
    siteStore.copyright = form.copyright
    siteStore.faviconUrl = cfg.faviconUrl || ''
    siteStore.logoUrl = cfg.logoUrl || ''
    siteStore.applyToDocument()
  } catch {
    /* http 层已提示 */
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  try {
    const res = await listSysRoles({ pageSize: 200 })
    roleOptions.value = res?.rows || []
  } catch {
    /* 角色列表拉不到不影响其它配置的编辑 */
  }
}

/** 上传站点标识图（登录页/页头用） */
async function onPickLogo(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const cfg = await uploadSiteLogo(file)
    localLogoPreview.value = ''
    siteStore.logoUrl = cfg.logoUrl || ''
    ElMessage.success('站点标识图已更新，登录页与页头立即生效')
  } catch {
    /* http 层已提示 */
  }
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const cfg = await uploadSiteFavicon(file)
    localPreview.value = ''
    siteStore.faviconUrl = cfg.faviconUrl || ''
    siteStore.logoUrl = cfg.logoUrl || ''
    siteStore.applyToDocument()
    ElMessage.success('站点图标已更新')
  } catch {
    /* http 层已提示 */
  }
}

async function save() {
  if (!form.siteName.trim()) {
    ElMessage.warning('站点名称不能为空')
    return
  }
  saving.value = true
  try {
    const cfg = await updateSiteConfig({
      siteName: form.siteName.trim(),
      icp: form.icp,
      copyright: form.copyright,
      registerEnabled: form.registerEnabled,
      registerRoleIds: selectedRoleIds.value.join(','),
      resetEnabled: form.resetEnabled,
      mailEnabled: form.mailEnabled,
      mailHost: form.mailHost,
      mailPort: form.mailPort,
      mailEncrypt: form.mailEncrypt,
      mailUsername: form.mailUsername,
      // 空字符串=保持原密码不变
      mailPassword: form.mailPassword,
      mailFrom: form.mailFrom,
      mailFromName: form.mailFromName
    })
    applyConfig(cfg)
    siteStore.siteName = cfg.siteName
    siteStore.icp = cfg.icp || ''
    siteStore.copyright = cfg.copyright || ''
    siteStore.applyToDocument()
    // 保存后刷新公开配置里的入口开关
    siteStore.load()
    ElMessage.success('站点配置已保存')
  } catch {
    /* http 层已提示 */
  } finally {
    saving.value = false
  }
}

async function handleTestMail() {
  const to = testTo.value.trim()
  if (!to) {
    ElMessage.warning('请先填写测试收件人邮箱')
    return
  }
  testing.value = true
  try {
    await testSiteMail(to)
    ElMessage.success('测试邮件已发送，请查收')
  } catch {
    /* http 层已提示失败原因 */
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  load()
  loadRoles()
})
</script>

<style scoped>
/* 外层固定占位：站点配置项较多，内容远超一屏 */
.sys-page {
  background: white;
  border-radius: 8px;
  height: calc(100vh - 110px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 内层滚动区：只有表单区域滚动，标题与页面外框保持不动 */
.page-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px 20px 40px;
}
.page-header {
  margin-bottom: 18px;
  h3 { margin: 0 0 4px; font-size: 16px; }
  .hint { color: #909399; font-size: 12px; }
}
/* 分组标题：用左侧竖条区分「基础信息 / 注册 / 找回 / 邮件」四块 */
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 26px 0 16px;
  padding-left: 9px;
  border-left: 3px solid #409eff;
  line-height: 1.2;
}
.section-title:first-of-type {
  margin-top: 0;
}
.tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.6;

  &.inline {
    margin-left: 10px;
  }

  .warn {
    color: #e6a23c;
  }
}
.favicon-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.favicon-preview.logo {
  width: 56px;
  height: 56px;
}
.favicon-preview {
  width: 48px;
  height: 48px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  background: #fafafa;
  overflow: hidden;
  flex-shrink: 0;

  img { width: 100%; height: 100%; object-fit: contain; }
}
.favicon-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}
.test-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
