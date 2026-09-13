<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="520px"
    append-to-body
    class="props-dialog"
  >
    <div v-if="target" class="props-body">
      <div class="props-head">
        <div class="props-icon">
          <el-icon :size="34" :color="headIconColor"><component :is="headIcon" /></el-icon>
        </div>
        <div class="props-title">
          <div class="name" :title="displayName">{{ displayName }}</div>
          <div class="sub">{{ subtitle }}</div>
        </div>
      </div>

      <el-descriptions :column="1" border size="small" class="props-table">
        <el-descriptions-item v-for="row in rows" :key="row.label" :label="row.label">
          <span v-if="row.copyable" class="mono" :title="row.value">{{ row.value }}</span>
          <span v-else>{{ row.value }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 图片/视频给个小预览，方便确认是不是要找的那个文件 -->
      <div v-if="thumbUrl" class="props-thumb">
        <img :src="thumbUrl" alt="缩略图" @error="thumbFailed = true" />
      </div>
    </div>

    <template #footer>
      <el-button v-if="copyText" @click="copyAll">复制信息</el-button>
      <el-button type="primary" @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Document, Folder as FolderIcon, Picture, VideoCamera, Headset,
  Files as FilesIcon, Tickets, DataAnalysis, Box
} from '@element-plus/icons-vue'
import type { DocFile, Folder } from '@/types/doc'
import { getCategory } from '@/types/doc'
import { ensureNames, displayUserName } from '@/utils/subjectNames'

/**
 * 属性对话框
 *
 * 展示文件/文件夹的完整元数据：大小、类型、位置、创建者、时间、SHA-256 等。
 * 这些字段后端 /api/doc/files/{id} 已经返回，这里只做展示与格式化，不再单独取数。
 */
const props = defineProps<{
  modelValue: boolean
  /** 文件或文件夹 */
  target: DocFile | Folder | null
  targetType: 'file' | 'folder'
  /** 所在位置的路径文本，如「全部文档 / 技术部 / 手册」 */
  locationPath?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const thumbFailed = ref(false)

const isFile = computed(() => props.targetType === 'file')
const file = computed(() => (isFile.value ? (props.target as DocFile) : null))
const folder = computed(() => (!isFile.value ? (props.target as Folder) : null))

const displayName = computed(() =>
  isFile.value ? file.value?.fileName || '' : folder.value?.folderName || ''
)

const title = computed(() => (isFile.value ? '文件属性' : '文件夹属性'))

const category = computed(() => {
  const f = file.value
  if (!f) return 'unknown'
  return getCategory(f.mimeType, f.fileExtension)
})

const headIcon = computed(() => {
  if (!isFile.value) return FolderIcon
  switch (category.value) {
    case 'image': return Picture
    case 'video': return VideoCamera
    case 'audio': return Headset
    case 'archive': return Box
    case 'office': return Tickets
    case 'text': case 'code': return DataAnalysis
    case '3d': return Box
    default: return Document
  }
})

const headIconColor = computed(() => (isFile.value ? '#409eff' : '#e6a23c'))

const subtitle = computed(() => {
  if (!isFile.value) return `文件夹 · ${folder.value?.folderPath || ''}`
  const ext = file.value?.fileExtension
  return ext ? `${ext.toUpperCase()} 文件` : '文件'
})

const thumbUrl = computed(() => {
  if (thumbFailed.value) return ''
  const f = file.value
  if (!f) return ''
  if (category.value === 'image') return `/api/doc/files/${f.fileId}/preview`
  if (category.value === 'video') return f.thumbnailUrl || `/api/doc/files/${f.fileId}/thumbnail`
  return ''
})

const CATEGORY_LABEL: Record<string, string> = {
  pdf: 'PDF 文档', image: '图片', video: '视频', audio: '音频',
  text: '文本', code: '文本/代码', office: 'Office 文档',
  cad: 'CAD 图纸', archive: '压缩包', '3d': '3D 模型', unknown: '未知类型'
}

function fmtSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}（${bytes.toLocaleString('zh-CN')} 字节）`
}

function fmtTime(t?: string): string {
  if (!t) return '—'
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fmtDuration(ms?: number): string {
  if (!ms || ms <= 0) return '—'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

interface Row { label: string; value: string; copyable?: boolean }

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  if (!props.target) return out

  if (isFile.value && file.value) {
    const f = file.value
    out.push({ label: '文件类型', value: `${CATEGORY_LABEL[category.value] || '未知类型'}${f.mimeType ? `（${f.mimeType}）` : ''}` })
    out.push({ label: '大小', value: fmtSize(f.fileSize) })
    if (f.pageCount) out.push({ label: '页数', value: `${f.pageCount} 页` })
    if (f.width && f.height) out.push({ label: '尺寸', value: `${f.width} × ${f.height} 像素` })
    if (f.durationMs) out.push({ label: '时长', value: fmtDuration(f.durationMs) })
  } else if (folder.value) {
    out.push({ label: '类型', value: '文件夹' })
  }

  if (props.locationPath) out.push({ label: '位置', value: props.locationPath })

  out.push({
    label: isFile.value ? '上传者' : '所有者',
    value: isFile.value
      ? displayUserName(file.value?.creatorId)
      : displayUserName(folder.value?.ownerId)
  })
  out.push({ label: '创建时间', value: fmtTime(isFile.value ? file.value?.createTime : folder.value?.createTime) })
  out.push({ label: '修改时间', value: fmtTime(isFile.value ? file.value?.updateTime : folder.value?.updateTime) })

  if (isFile.value && file.value) {
    const f = file.value
    out.push({ label: 'SHA-256', value: f.fileHash || '—', copyable: true })
    if (f.description) out.push({ label: '描述', value: f.description })
    // 存储信息只对管理员有意义，但属于「属性」应有的透明度，保留展示
    out.push({ label: '存储位置', value: f.mimeType ? 'MinIO 对象存储' : '—' })
    out.push({ label: '预览/缩略图', value: `${f.thumbnailUrl ? '已生成缩略图' : '无缩略图'} / ${f.previewUrl ? '有预览' : '无预览'}` })
  } else if (folder.value) {
    const fo = folder.value
    if (fo.description) out.push({ label: '描述', value: fo.description })
    out.push({ label: '内部路径', value: fo.folderPath || '—', copyable: true })
  }

  return out
})

const copyText = computed(() =>
  rows.value.map((r) => `${r.label}：${r.value}`).join('\n')
)

async function copyAll() {
  try {
    await navigator.clipboard.writeText(`${displayName.value}\n${copyText.value}`)
    ElMessage.success('属性信息已复制')
  } catch {
    ElMessage.warning('浏览器未授权剪贴板，请手动选择复制')
  }
}

// 解析创建者/所有者的真实姓名
watch(
  () => props.target,
  (t) => {
    thumbFailed.value = false
    if (!t) return
    if (isFile.value) {
      ensureNames('user', [(t as DocFile).creatorId])
    } else {
      ensureNames('user', [(t as Folder).ownerId])
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.props-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.props-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f2f5;
}

.props-icon {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.props-title {
  min-width: 0;

  .name {
    font-size: 15px;
    font-weight: 600;
    color: #303133;
    word-break: break-all;
  }

  .sub {
    font-size: 12px;
    color: #909399;
    margin-top: 2px;
  }
}

.props-table :deep(.el-descriptions__label) {
  width: 110px;
  color: #606266;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.props-thumb {
  text-align: center;

  img {
    max-width: 100%;
    max-height: 180px;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    background: #fafafa;
  }
}
</style>
