<template>
  <div class="oo-wrap">
    <div v-if="loading" class="oo-hint">
      <el-icon class="is-loading" :size="22"><Loading /></el-icon>
      <span>正在加载在线文档…</span>
    </div>
    <div v-else-if="error" class="oo-hint error">
      <el-icon :size="22"><Warning /></el-icon>
      <span>{{ error }}</span>
    </div>
    <!-- OnlyOffice 编辑器挂载点 -->
    <div v-show="!loading && !error" :id="editorId" class="oo-editor" />
    <!-- 水印浮层：覆盖在编辑器 iframe 之上 -->
    <WatermarkOverlay :text="watermark.text" :enabled="watermark.enabled" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Loading, Warning } from '@element-plus/icons-vue'
import { getOnlyOfficeConfig } from '@/api/onlyoffice'
import WatermarkOverlay from './WatermarkOverlay.vue'

const props = defineProps<{
  fileId: number | string
}>()

const editorId = `oo-editor-${Math.random().toString(36).slice(2, 10)}`
const loading = ref(true)
const error = ref('')
const watermark = ref<{ enabled: boolean; text: string }>({ enabled: false, text: '' })
let editor: any = null
let scriptLoaded = ''

/** 动态加载 OnlyOffice 的 api.js（同一地址只加载一次） */
function loadApi(dsUrl: string): Promise<void> {
  const src = `${dsUrl.replace(/\/$/, '')}/web-apps/apps/api/documents/api.js`
  if (scriptLoaded === src && (window as any).DocsAPI) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-oo="1"]`)
    if (existing && scriptLoaded === src && (window as any).DocsAPI) return resolve()
    existing?.remove()
    const el = document.createElement('script')
    el.src = src
    el.dataset.oo = '1'
    el.onload = () => { scriptLoaded = src; resolve() }
    el.onerror = () => reject(new Error('无法加载 OnlyOffice 脚本，请确认文档服务可访问'))
    document.head.appendChild(el)
  })
}

async function init() {
  loading.value = true
  error.value = ''
  destroy()
  try {
    const payload = await getOnlyOfficeConfig(props.fileId)
    if (payload.watermark) watermark.value = payload.watermark
    await loadApi(payload.dsUrl)
    const DocsAPI = (window as any).DocsAPI
    if (!DocsAPI) throw new Error('OnlyOffice 初始化失败（DocsAPI 未就绪）')
    // 等 DOM 就绪后再挂载
    await new Promise(r => setTimeout(r, 30))
    editor = new DocsAPI.DocEditor(editorId, payload.config)
  } catch (e: any) {
    error.value = e?.message || e?.msg || '在线文档加载失败'
  } finally {
    loading.value = false
  }
}

function destroy() {
  try { editor?.destroyEditor?.() } catch { /* 忽略 */ }
  editor = null
}

onMounted(init)
onBeforeUnmount(destroy)
watch(() => props.fileId, init)
</script>

<style scoped>
.oo-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  background: #f5f7fa;
}

.oo-editor {
  width: 100%;
  height: 100%;
  min-height: 420px;
}

.oo-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  min-height: 420px;
  color: #909399;
  font-size: 13px;

  &.error { color: #f56c6c; }
}
</style>
