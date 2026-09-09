<template>
  <div class="folder-tree">
    <div
      v-for="node in data"
      :key="node.folderId"
      class="tree-node"
    >
      <div
        class="tree-node-content"
        :class="{ active: selectedId === node.folderId, dropTarget: dropOverId === node.folderId }"
        :style="{ paddingLeft: 8 + (level || 0) * 16 + 'px' }"
        @click="$emit('select', node.folderId)"
        @dragover.prevent="onDragOver(node)"
        @dragleave="onDragLeave(node)"
        @drop.prevent="onDrop($event, node)"
      >
        <el-icon class="icon" @click.stop="toggle(node)"><Folder /></el-icon>
        <span class="label" @click.stop="$emit('select', node.folderId)">{{ node.folderName }}</span>
      </div>
      <div v-if="isOpen(node)">
        <FolderTree
          v-for="child in children[node.folderId] || []"
          :key="child.folderId"
          :data="[child]"
          :level="(level || 0) + 1"
          :selected-id="selectedId"
          @select="$emit('select', $event)"
          @drop="($ev: any, $f: any) => $emit('drop', $ev, $f)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Folder } from '@element-plus/icons-vue'
import type { Folder as FolderType } from '@/types/doc'
import { listChildren } from '@/api/doc'

const props = defineProps<{
  data: FolderType[]
  level?: number
  selectedId?: number
}>()

const emit = defineEmits<{
  (e: 'select', id: number): void
  (e: 'drop', ev: DragEvent, target: FolderType): void
}>()

const children = ref<Record<number, FolderType[]>>({})
const openIds = ref<Set<number>>(new Set())
const dropOverId = ref<number | null>(null)

function isOpen(node: FolderType) {
  return openIds.value.has(node.folderId)
}

async function toggle(node: FolderType) {
  if (openIds.value.has(node.folderId)) {
    openIds.value.delete(node.folderId)
    // 触发更新
    openIds.value = new Set(openIds.value)
  } else {
    openIds.value.add(node.folderId)
    openIds.value = new Set(openIds.value)
    if (!children.value[node.folderId]) {
      try {
        children.value[node.folderId] = await listChildren(node.folderId)
      } catch {
        children.value[node.folderId] = []
      }
    }
  }
}

function onDragOver(node: FolderType) {
  dropOverId.value = node.folderId
}

function onDragLeave(_node: FolderType) {
  if (dropOverId.value === _node.folderId) dropOverId.value = null
}

function onDrop(ev: DragEvent, node: FolderType) {
  dropOverId.value = null
  emit('drop', ev, node)
}
</script>

<style scoped>
.folder-tree {
  font-size: 14px;
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: #e6f1fc;
  }

  &.active {
    background: #409eff;
    color: white;

    .icon { color: white; }
  }

  &.dropTarget {
    background: #d9ecff;
    outline: 1px dashed #409eff;
  }

  .icon {
    color: #e6a23c;
    font-size: 16px;
    cursor: pointer;
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
