<template>
  <div class="file-list">
    <!-- 列表模式 -->
    <el-table
      v-if="viewMode === 'list'"
      :data="allItems"
      @selection-change="(rows) => $emit('selection-change', rows)"
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

    <!-- 大图标 / 平铺模式 -->
    <div v-else class="grid-view">
      <div
        v-for="item in allItems"
        :key="item.__type + (item.folderId || item.fileId)"
        class="grid-item"
        :class="{ selected: isSelected(item) }"
        @click="toggleSelect(item, $event)"
        @dblclick="$emit('dblclick', { type: item.__type, data: item })"
        @contextmenu.prevent="$emit('contextmenu', $event, { type: item.__type, data: item })"
      >
        <el-icon class="big-icon" :class="item.__type">
          <component :is="getIcon(item)" :size="48" />
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
  selection: DocFile[]
  viewMode: 'list' | 'large' | 'tile'
}>()

const emit = defineEmits<{
  (e: 'selection-change', rows: DocFile[]): void
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

function isSelected(item: any) {
  if (item.__type !== 'file') return false
  return props.selection.some(s => s.fileId === item.fileId)
}

function toggleSelect(item: any, event: MouseEvent) {
  if (event.shiftKey || event.ctrlKey || event.metaKey) {
    // 多选逻辑
    if (item.__type !== 'file') return
    const idx = props.selection.findIndex(s => s.fileId === item.fileId)
    if (idx >= 0) {
      emit('selection-change', props.selection.filter(s => s.fileId !== item.fileId))
    } else {
      emit('selection-change', [...props.selection, item])
    }
  } else {
    if (item.__type === 'file') {
      emit('selection-change', [item])
    }
  }
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
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  padding: 16px;
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f5f7fa;
  }

  &.selected {
    background: #e6f1fc;
    border: 1px solid #409eff;
  }

  .big-icon {
    color: #909399;

    &.folder { color: #e6a23c; }
  }

  .name {
    text-align: center;
    font-size: 13px;
    word-break: break-all;
    line-height: 1.4;
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
