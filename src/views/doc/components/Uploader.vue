<template>
  <div class="uploader-container">
    <Dashboard :uppy="uppy" :props="dashboardProps" />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import Uppy from '@uppy/core'
import Dashboard from '@uppy/dashboard'
import Tus from '@uppy/tus'
import Chinese from '@uppy/locales/lib/zh_CN.js'
import { useUserStore } from '@/stores/user'
import http from '@/api/http'

const props = defineProps<{
  folderId: number
  maxFileSize?: number
}>()

const emit = defineEmits<{
  (e: 'complete', file: any): void
}>()

const userStore = useUserStore()

/**
 * 单个文件 tus 上传完成后，通知后端写业务元数据（MinIO + doc_file）
 */
async function completeUpload(uploadUrl?: string, fileName?: string) {
  if (!uploadUrl) return
  const uploadId = uploadUrl.split('/').pop()
  if (!uploadId) return
  try {
    await http.post(`/api/upload/${uploadId}/complete`, { fileName })
    ElMessage.success(`文件 "${fileName || ''}" 上传完成`)
  } catch (e: any) {
    ElMessage.error(`文件 "${fileName || ''}" 完成处理失败`)
    console.error('completeUpload error', e)
  }
}

/**
 * 创建 Uppy 实例
 */
const uppy = computed(() => {
  const u = new Uppy({
    autoProceed: false,
    locale: Chinese,
    restrictions: {
      maxFileSize: props.maxFileSize ?? 1024 * 1024 * 1024, // 1GB
      maxNumberOfFiles: 1000,
      allowedFileTypes: undefined  // 不限制类型
    },
    meta: {
      folderId: String(props.folderId),
      userId: String(userStore.userId)
    }
  })
  .use(Tus, {
    endpoint: '/api/upload/tus',
    chunkSize: 5 * 1024 * 1024,  // 5MB
    retryDelays: [0, 1000, 3000, 5000, 10000],
    removeFingerprintOnSuccess: true,
    headers: () => ({
      Authorization: `Bearer ${userStore.token}`
    })
  })

  // 文件上传成功回调 → 后端写元数据
  u.on('upload-success', async (file, response) => {
    console.log('Upload success:', file?.name, response?.uploadURL)
    await completeUpload(response?.uploadURL, file?.name)
    emit('complete', { file, uploadUrl: response?.uploadURL })
  })

  // 错误回调
  u.on('upload-error', (file, error) => {
    console.error('Upload error:', file?.name, error)
  })

  return u
}).value

const dashboardProps = {
  theme: 'light',
  height: 400,
  proudlyDisplayPoweredByUppy: false,
  showProgressDetails: true,
  note: '支持单文件最大 1GB，单次最多 1000 个文件',
  locale: Chinese
}

onUnmounted(() => {
  uppy.cancelAll()
})
</script>

<style lang="scss">
.uploader-container {
  width: 100%;
  /* 覆盖 Uppy Dashboard 主题色 */
  --uppy-color-primary: #409eff;
  --uppy-color-primary-dark: #337ecc;
}
</style>
