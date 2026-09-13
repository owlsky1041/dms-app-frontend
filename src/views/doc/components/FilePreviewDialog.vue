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
    @opened="contentReady = true"
    @closed="onContentClosed"
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
      <!-- 等弹窗展开动画结束再渲染编辑器：OnlyOffice 在创建时按容器尺寸设置 iframe，
           过早创建会锁定成偏小的高度（底部留白） -->
      <template v-if="file && contentReady">
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
        <div v-else-if="isVideo" class="frame center video-frame" v-loading="!mediaUrl">
          <!--
            Plyr 包一层原生 <video>：src 走带签名令牌的直链（后端已把
            avi/mkv/wmv 转成 mp4 预览版就下发 mp4，否则回落原文件），
            poster 用后端 ffmpeg 抽的海报帧。
            Plyr 会把这个元素替换成自己的 DOM，所以它是这里唯一的子节点。
          -->
          <video
            ref="videoRef"
            :src="contentUrl"
            :poster="posterUrl"
            playsinline
            controls
            preload="metadata"
            style="width: 100%; height: 100%; max-height: 100%"
          >
            您的浏览器不支持该视频格式，请
            <a :href="downloadUrl" @click.prevent="downloadFile">下载后观看</a>。
          </video>
        </div>
        <div v-else-if="isAudio" class="frame center">
          <audio :src="contentUrl" controls style="width: 60%" />
        </div>
        <div v-else class="frame center unsupported">
          <el-icon :size="64"><Warning /></el-icon>
          <p>该格式不支持在线预览</p>
          <el-button type="primary" @click="downloadFile">下载文件</el-button>
        </div>

        <!--
          水印只加在"文档类"内容上（Office/PDF 由 OnlyOffice 自带水印浮层）。
          图片查看与视频播放不加：这两类本来就是看图/看画面，水印只会挡住内容，
          也和"能看就能看"的使用习惯不符。
        -->
        <WatermarkOverlay
          v-if="!isOffice && !isImage && !isVideo && !isAudio"
          :text="watermark.text"
          :enabled="watermark.enabled"
        />
      </template>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { Document, Warning, Download, Edit, Delete, FullScreen, Rank } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import PdfPreview from './PdfPreview.vue'
import OnlyOfficePreview from './OnlyOfficePreview.vue'
import WatermarkOverlay from './WatermarkOverlay.vue'
import { getWatermarkConfig, getSupportedFormats } from '@/api/onlyoffice'
import { getFileMedia } from '@/api/doc'
import type { DocFile } from '@/types/doc'
// PermissionFlag 作为值使用（位运算），不能用 import type
import { PermissionFlag } from '@/types/doc'
import { useUserStore } from '@/stores/user'
import { downloadFileById } from '@/utils/download'

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
/** 弹窗展开动画是否结束：结束后才挂载 OnlyOffice，保证容器尺寸已稳定 */
const contentReady = ref(false)

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
    loadMediaUrl()
    fullscreen.value = true   // 每次打开都默认整屏
  }
})
// 在预览弹窗里直接切到另一个文件时也要重取
watch(() => props.file?.fileId, () => {
  if (props.visible) loadMediaUrl()
})

/**
 * 内容流 URL
 *
 * 媒体类（图片/视频/音频）必须用带签名令牌的直链：这些内容由浏览器原生
 * <img>/<video> 直接加载，带不上 Authorization 头，指向需要登录的 /preview
 * 只会得到"加载失败"（后端把 401 包成了 HTTP 200，前端更不容易看出原因）。
 * 其余（PDF 等）仍走原来的 /preview，由 axios 带登录态取。
 */
const mediaUrl = ref('')
const contentUrl = computed(() => {
  if (!props.file?.fileId) return ''
  if (isMedia.value) return mediaUrl.value
  return props.file.previewUrl || `/api/doc/files/${props.file.fileId}/preview`
})

/**
 * 需要签名直链的类型
 *
 * 除了图片/视频/音频，PDF 也算：PdfPreview 里的 pdf.js 是自己发 XHR 取文件的，
 * 同样带不上 Authorization 头。现在 pdf 正常是被 OnlyOffice 接管的，
 * 但一旦把系统参数 dms.onlyoffice.enabled 关掉，就会回落到这条路径 ——
 * 不一起修好，那天关开关时会发现 PDF 全都打不开。
 */
const isMedia = computed(() => isImage.value || isVideo.value || isAudio.value || isPdf.value)

// ==================== 视频播放器（Plyr） ====================
const videoRef = ref<HTMLVideoElement>()
let player: Plyr | null = null

/**
 * 初始化 Plyr
 *
 * 必须等 <video> 真正挂到 DOM 上（媒体直链拿到、contentReady 之后）再初始化：
 * Plyr 会替换掉这个元素，元素不存在时初始化会静默失败、退回浏览器默认控件。
 */
async function setupPlayer() {
  if (!isVideo.value || !mediaUrl.value) return
  await nextTick()
  const el = videoRef.value
  // 元素还没挂上（弹窗展开动画未结束）就先不动：直接 return 会把已有的播放器留下，
  // 但更常见的是这次根本没建成，所以要靠 contentReady 的 watch 再补一次
  if (!el) return
  // 已经初始化过同一个元素就别重复包一层
  if (player && el.closest('.plyr')) return
  destroyPlayer()
  try {
    player = new Plyr(el, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'duration',
        'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
      settings: ['speed'],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      // 中文界面：控件 title 与提示都走这里
      i18n: {
        play: '播放', pause: '暂停', mute: '静音', unmute: '取消静音',
        enterFullscreen: '全屏', exitFullscreen: '退出全屏',
        settings: '设置', speed: '速度', normal: '正常', pip: '画中画'
      },
      tooltips: { controls: true, seek: true },
      // 键盘快捷键（空格播放/暂停、←→ 快进退、上下调音量）
      keyboard: { focused: true, global: false }
    })
  } catch (e) {
    console.warn('[FilePreviewDialog] Plyr 初始化失败，退回原生播放器', e)
  }
}

function destroyPlayer() {
  if (player) {
    try { player.destroy() } catch { /* 已经销毁过就算了 */ }
    player = null
  }
}

/** 打开预览时换一次直链；令牌有有效期，过期后前端拿到的就是 401，重新打开即可 */
async function loadMediaUrl() {
  mediaUrl.value = ''
  const f = props.file
  if (!f?.fileId || !isMedia.value) return
  try {
    const media = await getFileMedia(f.fileId)
    mediaUrl.value = media?.contentUrl || ''
    if (media?.thumbnailUrl) posterUrl.value = media.thumbnailUrl
    if (isVideo.value) await setupPlayer()
  } catch {
    /* 换链失败：内容区会显示加载失败，用户可据此重试 */
  }
}

const ext = computed(() => (props.file?.fileExtension || '').toLowerCase())

/** 视频海报（后端 ffmpeg 抽帧）。默认留空，由 loadMediaUrl 换成签名直链 */
const posterUrl = ref('')

/** 下载原文件的地址（视频放不了时提示下载） */
const downloadUrl = computed(() => {
  const f: any = props.file
  if (!f?.fileId) return ''
  return f.downloadUrl || `/api/doc/files/${f.fileId}/download`
})

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

/**
 * 当前用户对该文件的权限位（后端在列表/详情/搜索里都会带上）
 *
 * 缺省 0（而不是「满权限」）：宁可少显示按钮，也不要给出点了会报 403 的操作。
 */
const flags = computed(() => Number(props.file?.userFlags ?? 0))
const hasDownload = computed(() => Boolean(flags.value & PermissionFlag.DOWNLOAD))
/**
 * 是否可重命名/移动：需「编辑」位（读写档含它）或「完全控制」，
 * 或本人是该文件的上传者（上传者对自己的文件天然可管理）
 */
const hasManage = computed(() => {
  const MANAGE = PermissionFlag.EDIT | PermissionFlag.FULL_CONTROL
  if (flags.value & MANAGE) return true
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

async function downloadFile() {
  if (!props.file) return
  await downloadFileById(props.file.fileId, props.file.fileName)
}

function onContentClosed() {
  // 折叠时卸载编辑器与播放器；保持默认全屏，下次打开仍是整屏
  destroyPlayer()
  contentReady.value = false
}

// 内容区渲染出来（弹窗展开动画结束）后再补一次初始化
// —— 媒体直链通常比动画先回来，那时 <video> 还没挂上，只靠 loadMediaUrl 里的调用会漏掉
watch(contentReady, (v) => { if (v) setupPlayer() })

// 关掉弹窗时必须销毁 Plyr：它给 document 挂了键盘/全屏监听，留着会泄漏
onBeforeUnmount(destroyPlayer)
watch(() => props.visible, (v) => { if (!v) destroyPlayer() })
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
  /* 高度由下方全局样式的 flex 布局给出（占满对话框除头部外的全部空间），
     不再使用 calc(100vh - Npx) 这类魔法数字——它比实际可用高度差多少无法预知 */
  height: 100%;
  min-height: 0;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;

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

<!--
  全局样式（非 scoped）：el-dialog 被 teleport 到 body，scoped 选择器无法可靠命中其内部结构。
  目的：让对话框主体铺满「除头部之外的剩余高度」，避免底部留白。
  说明：之前用 calc(100vh - 140px) 估算，而实际可用高度 = 视口 - 头部 - 内边距 ≈ 视口 - 87px，
        多减的 53px 就成了底部空白。
-->
<style>
/* 整屏：对话框纵向 flex，头部固定、主体吃掉剩余空间 */
.preview-dialog.el-dialog {
  display: flex;
  flex-direction: column;
}
.preview-dialog .el-dialog__header {
  flex-shrink: 0;
  margin-right: 0;
}
/* 主体容器（Element Plus 生成 id 的那个 div）铺满剩余高度 */
.preview-dialog.is-fullscreen .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0 16px 12px;
}
/* 窗口模式：对话框高度不确定，给定高度保证预览可用 */
.preview-dialog:not(.is-fullscreen) .el-dialog__body {
  height: calc(100vh - 220px);
  overflow: hidden;
  padding: 0 16px 12px;
}
</style>
