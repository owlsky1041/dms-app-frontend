<template>
  <div ref="wrapRef" class="oo-wrap">
    <div v-if="loading" class="oo-hint">
      <el-icon class="is-loading" :size="22"><Loading /></el-icon>
      <span>正在加载在线文档…</span>
    </div>
    <div v-else-if="error" class="oo-hint error">
      <el-icon :size="22"><Warning /></el-icon>
      <span>{{ error }}</span>
    </div>
    <!-- OnlyOffice 挂载点。
         注意：api.js 会用 replaceChild 把这个 div **整体替换** 成 iframe[name=frameEditor]，
         因此不能靠这个 div 的 class 去写样式，尺寸由 fitEditor() 直接设置到 iframe 上。 -->
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
const wrapRef = ref<HTMLDivElement | null>(null)
let resizeObserver: ResizeObserver | null = null
let fitTimer: ReturnType<typeof setTimeout> | null = null
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

    // 关键：api.js 是把 config.width/height 直接赋给 iframe 的 width/height 属性，
    // 传 "100%" 时取值不可靠（父元素高度未定/动画中会锁定成偏小值）。
    // 这里在容器尺寸稳定后量出像素值再创建，保证一次铺满。
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const host = document.getElementById(editorId)?.parentElement || document.getElementById(editorId)
    const rect = host?.getBoundingClientRect()
    const w = Math.max(400, Math.floor(rect?.width || window.innerWidth))
    const h = Math.max(300, Math.floor(rect?.height || (window.innerHeight - 170)))
    payload.config.width = `${w}px`
    payload.config.height = `${h}px`

    editor = new DocsAPI.DocEditor(editorId, payload.config)
    // api.js 用 replaceChild 替换挂载点，稍后才拿到 iframe
    scheduleFit(0)
    scheduleFit(120)
    scheduleFit(400)
  } catch (e: any) {
    error.value = e?.message || e?.msg || '在线文档加载失败'
  } finally {
    loading.value = false
  }
}

/**
 * 让编辑器 iframe 铺满容器。
 *
 * api.js 的行为：把挂载点 div 用 replaceChild 换成 <iframe name="frameEditor">，
 * 并把 config.width/height 写成 iframe 的内联属性（只在创建时设一次，且没有 resize API）。
 * 因此这里在创建后主动把 iframe 及其到容器之间的每一层都设为 100%，窗口尺寸变化时再补一次。
 */
function fitEditor() {
  const wrap = wrapRef.value
  if (!wrap) return
  const iframe = wrap.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]')
  if (!iframe) return
  wrap.style.width = '100%'
  wrap.style.height = '100%'
  let el: HTMLElement | null = iframe
  let guard = 0
  while (el && el !== wrap && guard++ < 8) {
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.display = 'block'
    el.style.border = '0'
    el = el.parentElement
  }
}

/** 延迟补一次（api.js 替换 DOM 是异步的） */
function scheduleFit(delay = 80) {
  if (fitTimer) clearTimeout(fitTimer)
  fitTimer = setTimeout(fitEditor, delay)
}

function onWindowResize() {
  scheduleFit(200)
}

function destroy() {
  try { editor?.destroyEditor?.() } catch { /* 忽略 */ }
  editor = null
}

onMounted(() => {
  init()
  window.addEventListener('resize', onWindowResize)
  if (typeof ResizeObserver !== 'undefined' && wrapRef.value) {
    resizeObserver = new ResizeObserver(() => scheduleFit(30))
    resizeObserver.observe(wrapRef.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  resizeObserver?.disconnect()
  resizeObserver = null
  if (fitTimer) clearTimeout(fitTimer)
  destroy()
})
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

/*
 兜底：挂载点会被 api.js 替换成 iframe[name=frameEditor]，直接用属性选择器匹配它。
 （.oo-editor 本身已不存在，不能用 .oo-editor iframe）
*/
.oo-wrap :deep(iframe[name='frameEditor']) {
  width: 100% !important;
  height: 100% !important;
  display: block;
  border: 0;
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
