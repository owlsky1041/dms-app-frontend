<template>
  <div class="sys-page">
    <div class="page-header">
      <h3>站点配置</h3>
      <span class="hint">站点名称、登录页备案与版权信息、站点图标</span>
    </div>

    <el-form :model="form" label-width="110px" style="max-width: 620px" v-loading="loading">
      <el-form-item label="站点名称" required>
        <el-input v-model="form.siteName" maxlength="50" show-word-limit placeholder="例如：示例单位文档管理系统" />
        <div class="tip">用于浏览器标签标题、系统页头与登录页标题</div>
      </el-form-item>

      <el-form-item label="备案信息">
        <el-input v-model="form.icp" maxlength="120" placeholder="例如：浙ICP备2026000000号" />
        <div class="tip">显示在登录页底部，留空则不显示</div>
      </el-form-item>

      <el-form-item label="版权信息">
        <el-input v-model="form.copyright" maxlength="120" placeholder="例如：© 2026 示例单位 版权所有" />
        <div class="tip">显示在登录页底部，留空则不显示</div>
      </el-form-item>

      <el-form-item label="站点图标">
        <div class="favicon-row">
          <div class="favicon-preview">
            <img v-if="previewUrl" :src="previewUrl" alt="站点图标" />
            <el-icon v-else :size="26"><Picture /></el-icon>
          </div>
          <div class="favicon-actions">
            <input ref="fileInputRef" type="file" accept=".ico,.png,.svg,.jpg,.jpeg,.gif,.webp" style="display:none" @change="onPick" />
            <el-button size="small" @click="fileInputRef?.click()">选择图标</el-button>
            <span class="tip">支持 ico / png / svg / jpg / gif / webp，建议正方形（如 64×64）</span>
          </div>
        </div>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        <el-button @click="load">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Picture } from '@element-plus/icons-vue'
import { getSiteConfig, updateSiteConfig, uploadSiteFavicon } from '@/api/site'
import { useSiteStore } from '@/stores/site'

const siteStore = useSiteStore()
const loading = ref(false)
const saving = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
/** 本地新选图标的预览（blob URL），未选时用服务端的 */
const localPreview = ref('')

const form = reactive({
  siteName: 'DMS 文档管理',
  icp: '',
  copyright: ''
})

const previewUrl = computed(() => localPreview.value || siteStore.faviconUrl || '')

async function load() {
  loading.value = true
  try {
    const cfg = await getSiteConfig()
    form.siteName = cfg.siteName || 'DMS 文档管理'
    form.icp = cfg.icp || ''
    form.copyright = cfg.copyright || ''
    // 同步到全局 store，页头/标题立即生效
    siteStore.siteName = form.siteName
    siteStore.icp = form.icp
    siteStore.copyright = form.copyright
    siteStore.faviconUrl = cfg.faviconUrl || ''
    siteStore.applyToDocument()
  } catch {
    /* http 层已提示 */
  } finally {
    loading.value = false
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
      copyright: form.copyright
    })
    siteStore.siteName = cfg.siteName
    siteStore.icp = cfg.icp
    siteStore.copyright = cfg.copyright
    siteStore.applyToDocument()
    ElMessage.success('站点配置已保存')
  } catch {
    /* http 层已提示 */
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.sys-page {
  background: white;
  padding: 20px;
  border-radius: 8px;
  min-height: calc(100vh - 110px);
}
.page-header {
  margin-bottom: 18px;
  h3 { margin: 0 0 4px; font-size: 16px; }
  .hint { color: #909399; font-size: 12px; }
}
.tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
}
.favicon-row {
  display: flex;
  align-items: center;
  gap: 14px;
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
</style>
