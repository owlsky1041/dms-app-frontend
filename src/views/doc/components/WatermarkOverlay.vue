<template>
  <!--
    预览水印浮层
    · 覆盖在预览区域之上（pointer-events:none，不影响交互）
    · 内容由系统参数 sys.watermark.text 配置，支持 {realName}/{account}/{date}/{time}
    · 适用于所有预览形态（OnlyOffice / PDF.js / 图片 / 视频）
  -->
  <div v-if="enabled && text" class="wm-layer" aria-hidden="true">
    <div class="wm-grid">
      <span v-for="i in count" :key="i" class="wm-text">{{ text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  text: string
  enabled?: boolean
}>()

const enabled = computed(() => props.enabled !== false)
/** 平铺数量：保证空白区域也有水印覆盖 */
const count = 24
</script>

<style scoped>
.wm-layer {
  position: absolute;
  inset: 0;
  z-index: 20;
  overflow: hidden;
  pointer-events: none;   /* 不拦截鼠标事件，预览仍可滚动/缩放 */
  user-select: none;
}

.wm-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 1fr;
  width: 100%;
  height: 100%;
}

.wm-text {
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(-28deg);
  color: rgba(120, 120, 120, 0.16);
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  letter-spacing: 1px;
}
</style>
