<template>
  <!--
    文件预览弹窗
    · 双击文件打开（不再占用右侧预览栏，列表因此可以获得更大宽度）
    · Office/PDF 走 OnlyOffice 在线查看；图片/视频/音频回退到浏览器原生渲染
    · 统一叠加水印（内容来自系统参数）
  -->
  <el-dialog
    v-model="visible"
    :fullscreen="fullscreen"
    width="90%"
    top="3vh"
    :close-on-click-modal="false"
    destroy-on-close
    class="preview-dialog"
    @closed="onClosed"
  >
    <template #header>
      <div class="dlg-head">
        <el-icon class="head-icon" :size="16"><Document /></el-icon>
        <span class="head-name" :title="file?.fileName">{{ file?.fileName }}</span>
        <span class="head-meta" v-if="file">
          {{ formatSize(file.fileSize) }} · {{ formatDate(file.updateTime) }}
        </span>
        <div class="head-actions">
          <el-button size="small" :icon="Download" :disabled="!hasDownload" @click="downloadFile">下载</el-button>
          <el-button size="small" :icon="Edit" :disabled="!hasManage" @click="$emit('rename')">重命名</el-button>
          <el-button size="small" :icon="Delete" type="danger" :disabled="!hasDelete" @click="$emit('delete')">删除</el-button>
          <el-button size="small" :icon="fullscreen ? Rank : FullScreen" @click="fullscreen = !fullscreen">
            {{ fullscreen ? '还原' : '全屏' }}
          </el-button>
        </div>
      </div>
    </template>

    <!-- 预览主体：固定高度，保证 OnlyOffice 铺满 -->
    <div class="dlg-body" :class="{ 'is-fullscreen': fullscreen }" v-loading="!file">
      <template v-if="file">
        <!-- Office / PDF：OnlyOffice（组件内自带水印浮层） -->
        <OnlyOfficePreview
          v-if="isOffice"
          :file-id="file.fileId"
          class="frame"
        />
        <PdfPreview
          v-else-if="isPdf"
          :src="contentUrl"
          class="frame"
        />
        <div v-else-if="isImage" class="frame center">
          <el-image
            :src="contentUrl"
            :preview-src-list="[contentUrl]"
            fit="contain"
            style="width: 100%; height: 100%"
          />
        </div>
        <div v-else-if="isVideo" class="frame center">
          <video :src="contentUrl" controls style="max-width: 100%; max-height: 100%" />
        </div>
        <div v-else-if="isAudio" class="frame center">
          <audio :src="contentUrl" controls style="width: 60%" />
        </div>
        <div v-else class="frame center unsupported">
          <el-icon :size="64"><Warning /></el-icon>
          <p>该格式不支持在线预览</p>
          <el-button type="primary" @click="downloadFile">下载文件</el-button>
        </div>

        <!-- 非 OnlyOffice 预览统一叠加水印 -->
        <WatermarkOverlay
          v-if="!isOffice"
          :text="watermark.text"
          :enabled="watermark.enabled"
        />
      </template>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { Document, Warning, Download, Edit, Delete, FullScreen, Rank } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import PdfPreview from './PdfPreview.vue'
import OnlyOfficePreview from './OnlyOfficePreview.vue'
import WatermarkOverlay from './WatermarkOverlay.vue'
import { getWatermarkConfig, getSupportedFormats } from '@/api/onlyoffice'
import type { DocFile } from '@/types/doc'
// PermissionFlag 作为值使用（位运算），不能用 import type
import { PermissionFlag } from '@/types/doc'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  visible: boolean
  file: DocFile | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'rename'): void
  (e: 'delete'): void
}>()

const visible = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v)
})

const userStore = useUserStore()
/** 默认整屏显示（用户可点按钮切回窗口模式） */
const fullscreen = ref(true)

/** 水印配置（内容来自系统参数，按当前登录用户解析占位符） */
const watermark = ref<{ enabled: boolean; text: string }>({ enabled: false, text: '' })
async function loadWatermark() {
  try {
    const wm = await getWatermarkConfig()
    watermark.value = { enabled: !!wm?.enabled, text: wm?.text || '' }
  } catch { /* 水印不可用不影响预览 */ }
}
onMounted(() => {
  loadWatermark()
  loadFormats()
})
watch(() => props.visible, (v) => {
  if (v) {
    loadWatermark()
    loadFormats()
    fullscreen.value = true   // 每次打开都默认整屏
  }
})

/** 内容流 URL（后端按 fileId 从 MinIO 流式输出，支持 Range） */
const contentUrl = computed(() => {
  if (!props.file?.fileId) return ''
  return props.file.previewUrl || `/api/doc/files/${props.file.fileId}/preview`
})

const ext = computed(() => (props.file?.fileExtension || '').toLowerCase())

/**
 * 文档服务支持的格式（扩展名 → 类型），由后端提供。
 * 不再前端硬编码，支持文档服务升级后新增的格式。
 */
const supportedFormats = ref<Record<string, string>>({})
async function loadFormats() {
  if (Object.keys(supportedFormats.value).length) return
  try {
    supportedFormats.value = (await getSupportedFormats()) || {}
  } catch { /* 失败时退化为不支持 */ }
}

const isPdf = computed(() => ext.value === 'pdf')
/** 是否交给 OnlyOffice：支持格式一览中的都走它（含 pdf、Visio 图表等） */
const isOffice = computed(() => Boolean(ext.value && supportedFormats.value[ext.value]))
const isImage = computed(() => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext.value))
const isVideo = computed(() => ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext.value))
const isAudio = computed(() => ['mp3', 'wav', 'ogg', 'flac'].includes(ext.value))

const flags = computed(() => props.file?.userFlags ?? PermissionFlag.FULL_CONTROL)
const hasDownload = computed(() => Boolean(flags.value & PermissionFlag.DOWNLOAD))
/**
 * 是否可重命名/移动：需「完全控制」，或本人是该文件的上传者
 * （「编辑」位已取消，改由完全控制 + 上传者身份判定）
 */
const hasManage = computed(() => {
  if (flags.value & PermissionFlag.FULL_CONTROL) return true
  const creator = (props.file as any)?.creatorId
  return Boolean(creator && String(creator) === String(userStore.userId))
})
const hasDelete = computed(() => Boolean(flags.value & PermissionFlag.DELETE))

function formatSize(bytes?: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(date?: string) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '—'
}

function downloadFile() {
  if (!props.file) return
  // 带 token 的流式下载（axios 已注入 Authorization + clientid）
  import('@/api/http').then(async ({ default: http }) => {
    try {
      const resp = await http.get(`/api/doc/files/${props.file!.fileId}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(resp.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = props.file!.fileName || 'download'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('download failed', e)
    }
  })
}

function onClosed() {
  // 保持默认全屏，下次打开仍是整屏
}
</script>

<style scoped>
.dlg-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  .head-icon { color: #409eff; flex-shrink: 0; }

  .head-name {
    font-size: 15px;
    font-weight: 600;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .head-meta {
    font-size: 12px;
    color: #909399;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .head-actions {
    margin-left: auto;
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
}

/* 预览主体固定高度：OnlyOffice / PDF 铺满 */
.dlg-body {
  position: relative;
  height: calc(100vh - 190px);
  min-height: 400px;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;

  /* 整屏模式：占满对话框剩余高度 */
  &.is-fullscreen {
    height: calc(100vh - 140px);
  }

  .frame {
    width: 100%;
    height: 100%;
  }

  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .unsupported {
    gap: 10px;
    color: #909399;

    p { margin: 0; }
  }
}
</style>
