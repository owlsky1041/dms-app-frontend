<template>
  <!-- PhotoSwipe 自己管理 DOM，这里只放一个挂载点 -->
  <div ref="hostRef" class="pswp-host" />
</template>

<script setup lang="ts">
/**
 * 图片查看（PhotoSwipe 5）
 *
 * 为什么单独做一个组件：PhotoSwipe 是命令式 API（new / loadAndOpen / destroy），
 * 与 Vue 的声明式渲染是两套模型，混在预览弹窗里会很难维护。
 * 这里把它包起来，对外只暴露 open()。
 *
 * 与旧实现（el-image + Element Plus viewer）的区别：
 *   · 能翻阅**整个目录**的图片（左右方向键 / 滑动 / 缩略图条），不用退回列表再点下一张
 *   · 打开时按真实像素算初始缩放，不会先按错误比例显示再"跳"一下
 *   · 真·全屏查看，适合看仪表照片这种细节多的图
 */
import { onBeforeUnmount, ref, shallowRef } from 'vue'

/** 一张图 */
export interface GalleryItem {
  fileId: string
  src: string          // 带签名令牌的直链
  width: number
  height: number
  fileName?: string
  /** 是否允许下载（决定工具栏里那个按钮显不显示） */
  canDownload?: boolean
}

const emit = defineEmits<{
  (e: 'download', item: GalleryItem): void
}>()

const hostRef = ref<HTMLElement>()
/** 用 shallowRef：PhotoSwipe 实例内部结构庞大，不需要深度响应式 */
const lightbox = shallowRef<any>(null)
let current: GalleryItem[] = []

/**
 * 打开图集
 *
 * @param items 目录里的图片（已按显示顺序排好）
 * @param index 从第几张开始看
 */
async function open(items: GalleryItem[], index = 0) {
  if (!items.length) return
  current = items
  close()

  // 动态引入：PhotoSwipe 主模块约 25KB，只在真正看图时才加载
  const [{ default: PhotoSwipeLightbox }, { default: PhotoSwipe }] = await Promise.all([
    import('photoswipe/lightbox'),
    import('photoswipe')
  ])
  await import('photoswipe/style.css')

  const lb = new PhotoSwipeLightbox({
    // 直接给数据源，不依赖页面里已有 <a> 标签
    dataSource: items.map(it => ({
      src: it.src,
      width: it.width,
      height: it.height,
      alt: it.fileName || ''
    })),
    pswpModule: () => Promise.resolve(PhotoSwipe),
    index: Math.max(0, Math.min(index, items.length - 1)),
    bgOpacity: 0.92,
    showHideAnimationType: 'zoom',
    // 图片查看不需要水印（用户明确要求），PhotoSwipe 也没有内置水印能力
    padding: { top: 24, bottom: 24, left: 12, right: 12 }
  })

  // 工具栏：下载 + 文件名 + 计数，其余用 PhotoSwipe 自带的缩放/翻页
  lb.on('uiRegister', () => {
    lb.pswp.ui.registerElement({
      name: 'dms-caption',
      order: 9,
      isButton: false,
      html: '',
      onInit: (el: HTMLElement, pswp: any) => {
        pswp.on('change', () => {
          const it = current[pswp.currIndex]
          el.textContent = it ? (it.fileName || '') : ''
        })
      }
    })
    lb.pswp.ui.registerElement({
      name: 'dms-download',
      order: 8,
      isButton: true,
      tagName: 'button',
      title: '下载原图',
      html: '下载',
      onInit: (el: HTMLElement, pswp: any) => {
        el.classList.add('pswp__dms-download')
        el.addEventListener('click', () => {
          const it = current[pswp.currIndex]
          if (it) emit('download', it)
        })
        // 当前这张没有下载权限就把按钮藏起来，而不是点了报错
        pswp.on('change', () => {
          const it = current[pswp.currIndex]
          el.style.display = it && it.canDownload ? '' : 'none'
        })
      }
    })
  })

  lb.on('close', () => {
    // 关闭后销毁，避免重复 open 叠加多个实例
    lb.destroy()
    if (lightbox.value === lb) lightbox.value = null
  })

  lightbox.value = lb
  lb.init()
  lb.loadAndOpen(Math.max(0, Math.min(index, items.length - 1)))
}

function close() {
  const lb = lightbox.value
  if (lb) {
    try { lb.destroy() } catch { /* 已经销毁过就算了 */ }
    lightbox.value = null
  }
}

onBeforeUnmount(close)

defineExpose({ open, close })
</script>

<style scoped>
.pswp-host {
  display: none;
}
</style>

<style>
/* 工具栏按钮与文件名（PhotoSwipe 的样式文件是全局的，这里也保持全局） */
.pswp__dms-download {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  margin-right: 6px;
}
.pswp__dms-download:hover {
  background: rgba(255, 255, 255, 0.24);
}
.pswp__dms-caption {
  color: #fff;
  font-size: 13px;
  line-height: 32px;
  max-width: 50vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.85;
}
</style>
