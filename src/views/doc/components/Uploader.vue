<template>
  <div class="uploader-container">
    <!-- 自定义工具栏：选文件 / 选文件夹 -->
    <div class="uploader-toolbar">
      <el-button type="primary" :icon="FolderOpened" @click="pickFolder">选择文件夹上传</el-button>
      <el-button :icon="Upload" @click="pickFile">选择文件</el-button>
      <span class="hint">支持断点续传 · 单文件最大 1GB · 单次最多 1000 个文件</span>
      <input ref="folderInputRef" type="file" multiple webkitdirectory style="display:none" @change="onPickFolder" />
      <input ref="fileInputRef" type="file" multiple style="display:none" @change="onPickFile" />
    </div>
    <!-- Uppy Dashboard 挂载点 -->
    <div ref="dashboardElRef" class="uppy-dashboard"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { FolderOpened, Upload } from '@element-plus/icons-vue'
import Uppy, { type Uppy as UppyType } from '@uppy/core'
import Dashboard from '@uppy/dashboard'
import Tus from '@uppy/tus'
import Chinese from '@uppy/locales/lib/zh_CN.js'
import { useUserStore } from '@/stores/user'
import http, { CLIENT_ID } from '@/api/http'

// Uppy UI 样式（必须在组件里引入，否则 Dashboard 渲染异常/窄条）
import '@uppy/core/dist/style.css'
import '@uppy/dashboard/dist/style.css'

const props = defineProps<{
  folderId: number
  maxFileSize?: number
}>()

const emit = defineEmits<{
  (e: 'complete', file: any): void
}>()

const userStore = useUserStore()
const dashboardElRef = ref<HTMLDivElement | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
let uppy: UppyType | null = null

/** 单个文件 tus 上传完成后，通知后端写业务元数据（MinIO + doc_file） */
async function completeUpload(uploadUrl?: string, fileName?: string) {
  if (!uploadUrl) return
  const uploadId = uploadUrl.split('/').pop()
  if (!uploadId) return
  try {
    await http.post(`/api/upload/${uploadId}/complete`, { fileName })
    ElMessage.success(`文件「${fileName || ''}」上传完成`)
  } catch (e: any) {
    ElMessage.error(`文件「${fileName || ''}」完成处理失败`)
    console.error('completeUpload error', e)
  }
}

function pickFolder() {
  folderInputRef.value?.click()
}

function pickFile() {
  fileInputRef.value?.click()
}

async function onPickFolder(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length || !uppy) return
  try {
    // webkitdirectory：保留相对路径
    await uppy.addFiles(files.map((f: any) => ({
      source: 'local-folder',
      name: f.name,
      type: f.type || '',
      data: f,
      meta: { relativePath: f.webkitRelativePath || '' }
    })))
    uppy.upload()
  } catch (err: any) {
    ElMessage.error('添加文件夹失败：' + (err?.message || '未知错误'))
  }
  input.value = ''
}

async function onPickFile(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length || !uppy) return
  try {
    await uppy.addFiles(files.map((f) => ({
      source: 'local',
      name: f.name,
      type: f.type || '',
      data: f
    })))
    uppy.upload()
  } catch (err: any) {
    ElMessage.error('添加文件失败：' + (err?.message || '未知错误'))
  }
  input.value = ''
}

onMounted(() => {
  if (!dashboardElRef.value) return

  uppy = new Uppy({
    autoProceed: false,
    locale: Chinese,
    restrictions: {
      maxFileSize: props.maxFileSize ?? 1024 * 1024 * 1024, // 1GB
      maxNumberOfFiles: 1000,
      allowedFileTypes: undefined
    },
    meta: {
      folderId: String(props.folderId),
      userId: String(userStore.userId)
    }
  })

  uppy.use(Dashboard, {
    inline: true,
    target: dashboardElRef.value,
    theme: 'light',
    height: 380,
    showProgressDetails: true,
    proudlyDisplayPoweredByUppy: false,
    note: '支持单文件最大 1GB，单次最多 1000 个文件'
  })

  uppy.use(Tus, {
    endpoint: '/api/upload/tus',
    chunkSize: 5 * 1024 * 1024, // 5MB
    retryDelays: [0, 1000, 3000, 5000, 10000],
    removeFingerprintOnSuccess: true,
    headers: () => ({
      Authorization: `Bearer ${userStore.token}`,
      // RuoYi 6.0 Sa-Token 客户端校验：必须与 token 内 clientId 匹配
      clientid: CLIENT_ID
    })
  })

  uppy.on('upload-success', async (file, response) => {
    console.log('Upload success:', file?.name, response?.uploadURL)
    await completeUpload(response?.uploadURL, file?.name)
    emit('complete', { file, uploadUrl: response?.uploadURL })
  })

  uppy.on('upload-error', (file, error) => {
    console.error('Upload error:', file?.name, error)
  })
})

onBeforeUnmount(() => {
  uppy?.destroy()
  uppy = null
})
</script>

<style scoped>
.uploader-container {
  width: 100%;
}

.uploader-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;

  .hint {
    color: #909399;
    font-size: 12px;
    margin-left: 8px;
  }
}

.uppy-dashboard {
  width: 100%;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

/* 主题色覆盖 */
.uppy-dashboard :deep(.uppy-Button-primary) {
  background-color: #409eff;
}
</style>
