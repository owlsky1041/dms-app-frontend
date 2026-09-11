<template>
  <div class="preview-panel">
    <div v-if="!file" class="empty">
      <el-icon><View /></el-icon>
      <p>选择文件以预览</p>
    </div>
    <template v-else>
      <!-- 紧凑标题栏：让预览区占满右侧栏（原来顶部有 160px 缩略图 + 7 行元信息表，把空间吃光了） -->
      <div class="file-head">
        <el-icon class="head-icon" :size="16"><Document /></el-icon>
        <span class="head-name" :title="file.fileName">{{ file.fileName }}</span>
        <span class="head-meta">{{ formatSize(file.fileSize) }} · {{ formatDate(file.updateTime) }}</span>
        <el-button link size="small" class="head-toggle" @click="showMeta = !showMeta">
          {{ showMeta ? '收起详情' : '详情' }}
        </el-button>
      </div>

      <!-- 元信息详情：默认收起，不占用预览空间 -->
      <el-descriptions v-show="showMeta" :column="2" size="small" border class="meta-detail">
        <el-descriptions-item label="大小">{{ formatSize(file.fileSize) }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ file.mimeType || file.fileExtension || '—' }}</el-descriptions-item>
        <el-descriptions-item v-if="file.pageCount" label="页数">{{ file.pageCount }}</el-descriptions-item>
        <el-descriptions-item v-if="file.width && file.height" label="尺寸">
          {{ file.width }} × {{ file.height }}
        </el-descriptions-item>
        <el-descriptions-item label="创建">{{ formatDate(file.createTime) }}</el-descriptions-item>
        <el-descriptions-item label="修改">{{ formatDate(file.updateTime) }}</el-descriptions-item>
        <el-descriptions-item v-if="file.description" label="描述" :span="2">
          {{ file.description }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 预览区 -->
      <div class="preview">
        <!-- Office 文档：OnlyOffice 在线查看（组件内自带水印浮层） -->
        <OnlyOfficePreview
          v-if="isOffice"
          :file-id="props.file!.fileId"
          class="preview-frame"
        />
        <PdfPreview
          v-else-if="isPdf"
          :src="contentUrl"
          class="preview-frame"
        />
        <el-image
          v-else-if="isImage"
          :src="contentUrl"
          :preview-src-list="[contentUrl]"
          fit="contain"
          style="width: 100%; height: 100%"
        />
        <video
          v-else-if="isVideo"
          :src="contentUrl"
          controls
          style="width: 100%; max-height: 100%"
        />
        <audio
          v-else-if="isAudio"
          :src="contentUrl"
          controls
          style="width: 100%"
        />
        <div v-else class="unsupported">
          <el-icon :size="64"><Warning /></el-icon>
          <p>该格式不支持在线预览</p>
          <el-button type="primary" @click="downloadFile">下载文件</el-button>
        </div>
        <!-- 非 OnlyOffice 预览统一叠加水印（PDF / 图片 / 视频等） -->
        <WatermarkOverlay
          v-if="!isOffice"
          :text="watermark.text"
          :enabled="watermark.enabled"
        />
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <el-button-group>
          <el-button :icon="Download" @click="downloadFile" :disabled="!hasDownload">下载</el-button>
          <el-button :icon="Edit" @click="renameFile" :disabled="!hasManage">重命名</el-button>
          <el-button :icon="Share">共享</el-button>
          <el-button :icon="Delete" type="danger" @click="deleteFile" :disabled="!hasDelete">删除</el-button>
        </el-button-group>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Document, View, Warning, Download, Edit, Share, Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import PdfPreview from './PdfPreview.vue'
import OnlyOfficePreview from './OnlyOfficePreview.vue'
import WatermarkOverlay from './WatermarkOverlay.vue'
import { getWatermarkConfig } from '@/api/onlyoffice'
import type { DocFile } from '@/types/doc'
// PermissionFlag 作为值使用（位运算），不能用 import type
import { PermissionFlag } from '@/types/doc'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  file: DocFile | null
}>()

const emit = defineEmits<{
  (e: 'rename'): void
  (e: 'delete'): void
}>()

const userStore = useUserStore()

/** 元信息详情默认收起，把空间让给预览 */
const showMeta = ref(false)

/** 水印配置（内容来自系统参数，按当前登录用户解析占位符） */
const watermark = ref<{ enabled: boolean; text: string }>({ enabled: false, text: '' })
onMounted(async () => {
  try {
    const wm = await getWatermarkConfig()
    watermark.value = { enabled: !!wm?.enabled, text: wm?.text || '' }
  } catch { /* 水印不可用不影响预览 */ }
})

/** 内容流 URL（后端按 fileId 从 MinIO 流式输出，支持 Range） */
const contentUrl = computed(() => {
  if (!props.file?.fileId) return ''
  return props.file.previewUrl || `/api/doc/files/${props.file.fileId}/preview`
})

/** 下载 URL */
const downloadUrl = computed(() => {
  if (!props.file?.fileId) return ''
  return props.file.downloadUrl || `/api/doc/files/${props.file.fileId}/download`
})

const ext = computed(() => (props.file?.fileExtension || '').toLowerCase())
/** Office 文档（含 PDF）走 OnlyOffice 在线查看 */
const OFFICE_EXT = ['doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp']
const isPdf = computed(() => ext.value === 'pdf')
const isOffice = computed(() => OFFICE_EXT.includes(ext.value))
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

function formatSize(bytes: number): string {
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

function renameFile() {
  emit('rename')
}

function deleteFile() {
  emit('delete')
}
</script>

<style lang="scss" scoped>
.preview-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  gap: 8px;
  /* 关键：面板本身不滚动，由预览区内部滚动，这样预览才能吃满剩余高度 */
  overflow: hidden;
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  gap: 12px;

  p {
    margin: 0;
    font-size: 14px;
  }
}

.thumbnail {
  text-align: center;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.meta {
  .meta-name {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.preview {
  position: relative;   /* 水印浮层的定位基准 */
  flex: 1;
  /* min-height:0 是 flex 子项能被压缩/撑满的关键，否则会被内容顶成固定高度 */
  min-height: 0;
  overflow: auto;
  border: 1px solid #ebeef5;
  border-radius: 8px;

  .preview-frame {
    width: 100%;
    height: 100%;
  }
}

.unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: #909399;

  p { margin: 0; }
}

/* 紧凑标题栏 */
.file-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-width: 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #ebeef5;

  .head-icon { color: #409eff; flex-shrink: 0; }

  .head-name {
    font-size: 13px;
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

  .head-toggle { flex-shrink: 0; margin-left: auto; }
}

.meta-detail {
  flex-shrink: 0;
  max-height: 30%;
  overflow: auto;
  font-size: 12px;
}

.actions {
  display: flex;
  justify-content: center;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
