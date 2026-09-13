<template>
  <div
    ref="containerRef"
    class="file-list"
    :class="{ 'marquee-active': marquee.active }"
    @mousedown="onContainerMouseDown"
  >
    <!-- 橡皮筋框选矩形 -->
    <div
      v-if="marquee.active"
      class="marquee-box"
      :style="{
        left: marquee.rect.left + 'px',
        top: marquee.rect.top + 'px',
        width: marquee.rect.width + 'px',
        height: marquee.rect.height + 'px'
      }"
    />

    <!-- 列表模式 -->
    <el-table
      v-if="viewMode === 'list'"
      ref="tableRef"
      :data="allItems"
      :row-key="itemKey"
      @selection-change="onTableSelectionChange"
      @row-contextmenu="(row, _, event) => $emit('contextmenu', event, { type: row.__type, data: row })"
      @row-dblclick="(row) => $emit('dblclick', { type: row.__type, data: row })"
      style="width: 100%"
      stripe
      height="100%"
      v-loading="false"
    >
      <el-table-column type="selection" width="48" />
      <el-table-column label="名称" min-width="240">
        <template #default="{ row }">
          <div class="name-cell" :data-key="itemKey(row)">
            <el-icon class="icon" :class="row.__type">
              <component :is="getIcon(row)" />
            </el-icon>
            <span>{{ row.__type === 'folder' ? row.folderName : row.fileName }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="大小" width="120">
        <template #default="{ row }">
          {{ row.__type === 'file' ? formatSize(row.fileSize) : '—' }}
        </template>
      </el-table-column>
      <el-table-column label="修改时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.updateTime || row.createTime) }}
        </template>
      </el-table-column>
      <el-table-column label="创建者" width="120">
        <template #default="{ row }">
          <!-- 底层按 ID 关联，界面显示真实姓名（取不到时退回 ID） -->
          {{ displayUserName(row.__type === 'folder' ? row.ownerId : row.creatorId) }}
        </template>
      </el-table-column>
    </el-table>

    <!-- 大图标 / 小图标：两种网格，尺寸由 CSS 按模式区分 -->
    <div v-else class="grid-view" :class="viewMode === 'large' ? 'mode-large' : 'mode-tile'">
      <div
        v-for="item in allItems"
        :key="itemKey(item)"
        :data-key="itemKey(item)"
        class="grid-item"
        :class="{ selected: isSelected(item) }"
        draggable="true"
        @dragstart="onDragStart($event, item)"
        @click="toggleSelect(item, $event)"
        @dblclick="$emit('dblclick', { type: item.__type, data: item })"
        @contextmenu.prevent="$emit('contextmenu', $event, { type: item.__type, data: item })"
      >
        <el-icon class="item-icon" :class="item.__type">
          <component :is="getIcon(item)" />
        </el-icon>
        <span class="name">{{ item.__type === 'folder' ? item.folderName : item.fileName }}</span>
      </div>
      <div v-if="allItems.length === 0" class="empty">
        <el-icon><DocumentRemove /></el-icon>
        <p>此文件夹为空</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { ensureNames, displayUserName } from '@/utils/subjectNames'
import {
  Folder as FolderIcon, Document, Picture, VideoCamera, Headset,
  Files, Tickets, Box, DocumentRemove
} from '@element-plus/icons-vue'
import type { Folder as FolderType, DocFile } from '@/types/doc'
import dayjs from 'dayjs'

type ListItem = (FolderType | DocFile) & { __type: 'folder' | 'file' }

const props = defineProps<{
  folders: FolderType[]
  files: DocFile[]
  selection: ListItem[]   // 支持文件夹 + 文件混合选中
  viewMode: 'list' | 'large' | 'tile'
}>()

const emit = defineEmits<{
  (e: 'selection-change', rows: ListItem[]): void
  (e: 'open', data: any): void
  (e: 'contextmenu', event: MouseEvent, item: any): void
  (e: 'drop', target: FolderType, draggedIds: number[]): void
  (e: 'dblclick', item: { type: 'folder' | 'file'; data: any }): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const tableRef = ref<any>(null)

const allItems = computed<ListItem[]>(() => {
  const folders: ListItem[] = props.folders.map(f => ({ ...f, __type: 'folder' as const }))
  const files: ListItem[] = props.files.map(f => ({ ...f, __type: 'file' as const }))
  return [...folders, ...files]
})

// 列表内容变化时，声明需要解析的创建者/所有者 ID（内部合并成一次请求）
watch(allItems, (items) => {
  ensureNames('user', items.map((it: any) => (it.__type === 'folder' ? it.ownerId : it.creatorId)))
}, { immediate: true })

/** 取条目唯一 key（folder 用 folderId，file 用 fileId） */
function itemKey(item: any): string {
  if (!item) return ''
  return item.__type === 'folder' ? `folder-${item.folderId}` : `file-${item.fileId}`
}

function isSelected(item: any) {
  return props.selection.some(s => itemKey(s) === itemKey(item))
}

function toggleSelect(item: any, event: MouseEvent) {
  const key = itemKey(item)
  if (event.shiftKey || event.ctrlKey || event.metaKey) {
    // 多选：folder + file 均支持
    const idx = props.selection.findIndex(s => itemKey(s) === key)
    if (idx >= 0) {
      emit('selection-change', props.selection.filter(s => itemKey(s) !== key))
    } else {
      emit('selection-change', [...props.selection, item])
    }
  } else {
    // 单选（点击文件也作为选中项，文件夹仅选中不进入）
    emit('selection-change', [item])
  }
}

// ===================== 列表模式：父级选中态 → el-table =====================

/**
 * 把外部 selection 同步到 el-table 的勾选状态
 *
 * 没有这一步，Ctrl+A 与框选都只会改「逻辑选中」，复选框不会打勾，
 * 看起来像没选上。加 syncing 标志避免 sync → change → emit → sync 的循环。
 */
let syncingTable = false
watch(
  () => props.selection,
  async (sel) => {
    if (props.viewMode !== 'list' || !tableRef.value) return
    syncingTable = true
    try {
      tableRef.value.clearSelection()
      const keys = new Set((sel || []).map(itemKey))
      for (const row of allItems.value) {
        if (keys.has(itemKey(row))) {
          tableRef.value.toggleRowSelection(row, true)
        }
      }
    } finally {
      // 等 el-table 的 selection-change 回调走完再放开
      await nextTick()
      syncingTable = false
    }
  },
  { deep: false }
)

function onTableSelectionChange(rows: ListItem[]) {
  if (syncingTable) return
  emit('selection-change', rows as ListItem[])
}

// ============================ 橡皮筋框选 ============================

const marquee = reactive({
  active: false,
  startX: 0,
  startY: 0,
  /** 视口坐标（clientX/clientY），与 position:fixed 的矩形保持一致 */
  rect: { left: 0, top: 0, width: 0, height: 0 },
  /** 按下时是否按住了 Ctrl：按住 = 并入已有选择，否则替换 */
  additive: false,
  /** 是否发生过拖动（用于区分「点空白=清空选择」与真正的框选） */
  moved: false,
  /** 按下时已有的选择，Ctrl 并入时以此为基线 */
  baseKeys: [] as string[]
})

/** 是否从空白处开始拖拽（点在条目/表头/复选框上都不算） */
function shouldStartMarquee(e: MouseEvent): boolean {
  if (e.button !== 0) return false
  const el = e.target as HTMLElement
  if (!el) return false
  // 条目、表头（含全选复选框）、列宽拖拽手柄、分页都不触发
  if (el.closest('.grid-item, .el-table__row, .el-table__header-wrapper, .el-table__column-resize-proxy')) {
    return false
  }
  // 必须落在内容区域内：网格容器本身，或表格的 body 滚动区
  return Boolean(el.closest('.grid-view, .el-table__body-wrapper, .file-list'))
}

function onContainerMouseDown(e: MouseEvent) {
  if (!shouldStartMarquee(e)) return
  const container = containerRef.value
  if (!container) return

  void container
  marquee.active = true
  marquee.moved = false
  marquee.additive = e.ctrlKey || e.metaKey
  marquee.baseKeys = marquee.additive ? props.selection.map(itemKey) : []
  marquee.startX = e.clientX
  marquee.startY = e.clientY
  marquee.rect = { left: e.clientX, top: e.clientY, width: 0, height: 0 }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!marquee.active) return
  // 视口坐标直接可用：矩形是 fixed 定位，容器自身滚动也不会让框漂移
  marquee.rect = {
    left: Math.min(marquee.startX, e.clientX),
    top: Math.min(marquee.startY, e.clientY),
    width: Math.abs(e.clientX - marquee.startX),
    height: Math.abs(e.clientY - marquee.startY)
  }
  if (Math.abs(e.clientX - marquee.startX) > 3 || Math.abs(e.clientY - marquee.startY) > 3) {
    marquee.moved = true
  }
  if (marquee.moved) {
    applyMarqueeSelection()
  }
}

function onMouseUp() {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  const wasActive = marquee.active
  const moved = marquee.moved
  marquee.active = false

  if (!wasActive) return
  if (!moved) {
    // 空白处单击（没有拖动）→ 清空选择，符合 Windows 习惯
    if (!marquee.additive && props.selection.length) {
      emit('selection-change', [])
    }
    return
  }
  applyMarqueeSelection()
}

/**
 * 按当前矩形计算命中项并派发选择
 *
 * 命中判定用各条目在视口里的真实矩形与框选矩形求交，
 * 因此滚动位置、网格与列表两种布局都不需要特殊处理。
 */
function applyMarqueeSelection() {
  const container = containerRef.value
  if (!container) return
  const box = {
    left: marquee.rect.left,
    top: marquee.rect.top,
    right: marquee.rect.left + marquee.rect.width,
    bottom: marquee.rect.top + marquee.rect.height
  }

  const nodes = container.querySelectorAll('.grid-item[data-key], .el-table__row')
  const hitKeys = new Set<string>()
  nodes.forEach((node) => {
    const el = node as HTMLElement
    const key = el.classList.contains('grid-item')
      ? el.getAttribute('data-key')
      : el.querySelector('[data-key]')?.getAttribute('data-key')
    if (!key) return
    const r = el.getBoundingClientRect()
    const intersects = !(r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom)
    if (intersects) hitKeys.add(key)
  })

  const keys = marquee.additive ? new Set([...marquee.baseKeys, ...hitKeys]) : hitKeys
  const next = allItems.value.filter(it => keys.has(itemKey(it)))
  // 内容没变化就不派发，避免高频 mousemove 触发大量更新
  const cur = new Set(props.selection.map(itemKey))
  if (next.length === cur.size && next.every(it => cur.has(itemKey(it)))) return
  emit('selection-change', next)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

/** 拖拽源：把 (type,id,name) 放进 dataTransfer */
function onDragStart(event: DragEvent, item: any) {
  const payload = {
    type: item.__type,
    id: item.__type === 'folder' ? item.folderId : item.fileId,
    name: item.__type === 'folder' ? item.folderName : item.fileName
  }
  event.dataTransfer?.setData('application/x-dms-item', JSON.stringify(payload))
  event.dataTransfer!.effectAllowed = 'move'
}

function getIcon(item: any) {
  if (item.__type === 'folder') return FolderIcon
  const ext = (item.fileExtension || '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'bmp'].includes(ext)) return Picture
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return VideoCamera
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return Headset
  if (ext === 'pdf') return Document
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return Box
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return Tickets
  if (['glb', 'gltf', 'obj', 'stl', 'fbx'].includes(ext)) return Files
  return Document
}

function formatSize(bytes: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(date?: string) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '—'
}
</script>

<style lang="scss" scoped>
.file-list {
  flex: 1;
  overflow: auto;
  position: relative;

  /* 框选过程中禁止选中文字，否则会出现蓝色文本选区 */
  &.marquee-active {
    user-select: none;
  }
}

/* 橡皮筋框选矩形 */
.marquee-box {
  position: fixed;
  z-index: 2000;
  border: 1px solid #409eff;
  background: rgba(64, 158, 255, 0.16);
  pointer-events: none;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .icon {
    color: #909399;

    &.folder { color: #e6a23c; }
  }
}

.grid-view {
  display: grid;
  /* 默认（小图标）保持原有观感不变 */
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  padding: 16px;

  /* 大图标：格子更大、图标更大 */
  &.mode-large {
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 22px;

    .grid-item {
      padding: 28px 12px;
      gap: 14px;

      .item-icon { font-size: 96px; }
    }

    .name { font-size: 14px; }
  }
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;

  &:hover {
    background: #f5f7fa;
  }

  &.selected {
    background: #e6f1fc;
    border: 1px solid #409eff;
  }

  .item-icon {
    color: #909399;
    flex-shrink: 0;
    /* 小图标模式尺寸 = 改动前的 48px，保证「小图标」观感不变 */
    font-size: 48px;

    &.folder { color: #e6a23c; }
  }

  .name {
    text-align: center;
    word-break: break-all;
    line-height: 1.4;
    width: 100%;

    /* 最多两行，超出省略，避免长文件名把格子撑高 */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px;
  color: #909399;

  p {
    margin-top: 12px;
  }
}
</style>
