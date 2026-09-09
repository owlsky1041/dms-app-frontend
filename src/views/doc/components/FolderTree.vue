<template>
  <div class="folder-tree">
    <div
      v-for="node in data"
      :key="node.folderId"
      class="tree-node"
    >
      <div
        class="tree-node-content"
        :class="{ active: selectedId === node.folderId }"
        :style="{ paddingLeft: 8 + level * 16 + 'px' }"
        @click="$emit('select', node.folderId)"
        @drop="onDrop($event, node)"
        @dragover.prevent
      >
        <el-icon class="icon"><Folder /></el-icon>
        <span class="label">{{ node.folderName }}</span>
      </div>
      <FolderTree
        v-if="expanded[node.folderId] && children[node.folderId]?.length"
        :data="children[node.folderId]"
        :level="level + 1"
        :selected-id="selectedId"
        @select="(id) => $emit('select', id)"
        @drop="(ids) => $emit('drop', ids)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Folder } from '@element-plus/icons-vue'
import type { Folder as FolderType } from '@/types/doc'
import { listChildren } from '@/api/doc'

const props = defineProps<{
  data: FolderType[]
  level?: number
  selectedId?: number
}>()

defineEmits<{
  (e: 'select', id: number): void
  (e: 'drop', ids: number[]): void
}>()

const expanded = ref<Record<number, boolean>>({})
const children = ref<Record<number, FolderType[]>>({})

watch(
  () => props.data,
  (newData) => {
    // 默认展开第一层
    if (props.level === 0 || props.level === undefined) {
      newData.forEach((n) => {
        if (expanded.value[n.folderId] === undefined) {
          expanded.value[n.folderId] = true
          loadChildren(n.folderId)
        }
      })
    }
  },
  { immediate: true, deep: true }
)

async function loadChildren(folderId: number) {
  try {
    children.value[folderId] = await listChildren(folderId)
  } catch {
    children.value[folderId] = []
  }
}

function onDrop(event: DragEvent, node: FolderType) {
  const data = event.dataTransfer?.getData('text/dms-ids')
  if (data) {
    const ids = JSON.parse(data) as number[]
    // @ts-ignore
    arguments[2] // emit drop with node
  }
}
</script>

<style lang="scss" scoped>
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

  .icon {
    color: #e6a23c;
    font-size: 16px;
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
