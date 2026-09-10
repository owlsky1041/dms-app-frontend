<template>
  <div class="file-list">
    <!-- 列表模式 -->
    <el-table
      v-if="viewMode === 'list'"
      :data="allItems"
      @selection-change="(rows) => $emit('selection-change', rows as ListItem[])"
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
          <div class="name-cell">
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
          {{ row.creatorId || row.ownerId }}
        </template>
      </el-table-column>
    </el-table>

    <!-- 大图标 / 小图标：两种网格，尺寸由 CSS 按模式区分 -->
    <div v-else class="grid-view" :class="viewMode === 'large' ? 'mode-large' : 'mode-tile'">
      <div
        v-for="item in allItems"
        :key="item.__type + (item.folderId || item.fileId)"
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
import { computed } from 'vue'
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

const allItems = computed<ListItem[]>(() => {
  const folders: ListItem[] = props.folders.map(f => ({ ...f, __type: 'folder' as const }))
  const files: ListItem[] = props.files.map(f => ({ ...f, __type: 'file' as const }))
  return [...folders, ...files]
})

/** 取条目唯一 key（folder 用 folderId，file 用 fileId） */
function itemKey(item: any): string {
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
