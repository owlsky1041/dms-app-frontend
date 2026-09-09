<template>
  <div class="pdf-preview">
    <canvas ref="canvasRef" class="pdf-canvas" />
    <div class="controls">
      <el-button-group>
        <el-button @click="prevPage" :disabled="page <= 1">上一页</el-button>
        <el-button @click="nextPage" :disabled="page >= totalPages">下一页</el-button>
      </el-button-group>
      <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
      <div class="zoom-control">
        <span>缩放</span>
        <el-slider v-model="zoom" :min="50" :max="200" :step="10" style="width: 200px" />
        <span class="zoom-value">{{ zoom }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'

// 关键：配置 worker 路径
// 生产环境把 pdf.worker.min.mjs 放到 nginx 同级目录
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const props = defineProps<{
  src: string  // PDF URL
}>()

const canvasRef = ref<HTMLCanvasElement>()
const page = ref(1)
const totalPages = ref(1)
const zoom = ref(100)

let pdfDoc: any = null
let renderTask: any = null

async function loadDoc() {
  if (!props.src) return
  pdfDoc = await pdfjsLib.getDocument(props.src).promise
  totalPages.value = pdfDoc.numPages
  page.value = 1
  await renderPage()
}

async function renderPage() {
  if (!pdfDoc || !canvasRef.value) return
  if (renderTask) {
    renderTask.cancel()
  }

  const pageObj = await pdfDoc.getPage(page.value)
  const viewport = pageObj.getViewport({ scale: zoom.value / 100 })

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')!
  const dpr = window.devicePixelRatio || 1
  canvas.width = viewport.width * dpr
  canvas.height = viewport.height * dpr
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  ctx.scale(dpr, dpr)

  renderTask = pageObj.render({
    canvasContext: ctx,
    viewport
  })
  try {
    await renderTask.promise
  } catch (e: any) {
    if (e?.name !== 'RenderingCancelledException') {
      console.error(e)
    }
  }
}

const prevPage = () => { if (page.value > 1) { page.value-- } }
const nextPage = () => { if (page.value < totalPages.value) { page.value++ } }

onMounted(loadDoc)
watch(() => props.src, loadDoc)
watch([page, zoom], renderPage)
</script>

<style lang="scss" scoped>
.pdf-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f5f7fa;
  padding: 16px;
  height: 100%;
  overflow: auto;
}

.pdf-canvas {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  background: white;
}

.controls {
  position: sticky;
  bottom: 16px;
  background: white;
  padding: 8px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 16px;

  .page-info {
    color: #606266;
    font-weight: 500;
  }

  .zoom-control {
    display: flex;
    align-items: center;
    gap: 8px;

    .zoom-value {
      color: #606266;
      min-width: 50px;
    }
  }
}
</style>
