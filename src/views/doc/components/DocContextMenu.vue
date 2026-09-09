<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="doc-context-menu"
      :style="{ left: position.x + 'px', top: position.y + 'px' }"
      @click.stop
      @contextmenu.prevent.stop
    >
      <div
        v-for="(item, i) in menuItems"
        :key="i"
        class="ctx-item"
        :class="{ divider: item.divider, disabled: item.disabled }"
        @click="onClick(item)"
      >
        <el-icon v-if="item.icon && !item.divider"><component :is="iconComponent(item.icon)" /></el-icon>
        <span v-if="item.label">{{ item.label }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import * as Icons from '@element-plus/icons-vue'

export interface CtxItem {
  label?: string
  icon?: string
  disabled?: boolean
  divider?: boolean
  onClick?: () => void
}

const props = defineProps<{
  visible: boolean
  position: { x: number; y: number }
  items: CtxItem[]
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const menuItems = computed(() => props.items)

function iconComponent(name: string) {
  return (Icons as any)[name]
}

function onClick(item: CtxItem) {
  if (item.divider || item.disabled) return
  item.onClick?.()
  emit('close')
}

function onGlobalClick() {
  if (props.visible) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) emit('close')
}

function reposition() {
  // 防菜单溢出屏幕
}

onMounted(() => {
  window.addEventListener('click', onGlobalClick)
  window.addEventListener('keydown', onKey)
  window.addEventListener('scroll', onGlobalClick, true)
  window.addEventListener('resize', reposition)
})

onUnmounted(() => {
  window.removeEventListener('click', onGlobalClick)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onGlobalClick, true)
  window.removeEventListener('resize', reposition)
})
</script>

<style scoped>
.doc-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 160px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  padding: 4px;
  font-size: 13px;
  user-select: none;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: #303133;
}

.ctx-item:hover:not(.disabled):not(.divider) {
  background: #ecf5ff;
  color: #409eff;
}

.ctx-item.divider {
  height: 1px;
  padding: 0;
  margin: 4px 8px;
  background: #e4e7ed;
  cursor: default;
}

.ctx-item.disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.ctx-item .el-icon {
  font-size: 14px;
  color: #909399;
}

.ctx-item:hover .el-icon {
  color: #409eff;
}
</style>
