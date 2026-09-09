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
        :style="{ paddingLeft: 8 + (level || 0) * 18 + 'px' }"
        @click="$emit('select', node.folderId)"
        @dragover.prevent="onDragOver(node)"
        @dragleave="onDragLeave(node)"
        @drop.prevent="onDrop($event, node)"
      >
        <!-- 展开箭头（无子级时占位） -->
        <span
          class="arrow"
          :class="{ expanded: isOpen(node), leaf: !hasChildren(node) }"
          @click.stop="toggle(node)"
        >
          <el-icon v-if="hasChildren(node)" :size="12"><ArrowRight /></el-icon>
        </span>
        <el-icon class="icon" :size="15" @click.stop="toggle(node)"><Folder /></el-icon>
        <span class="label" @click.stop="$emit('select', node.folderId)">{{ node.folderName }}</span>
      </div>
      <!-- 展开的子级 -->
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
import { ref, watch } from 'vue'
import { Folder, ArrowRight } from '@element-plus/icons-vue'
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

function hasChildren(node: FolderType) {
  const arr = children.value[node.folderId]
  return Array.isArray(arr) ? arr.length > 0 : true // 未加载时假定有箭头，点击展开加载
}

function isOpen(node: FolderType) {
  return openIds.value.has(node.folderId)
}

async function toggle(node: FolderType) {
  if (openIds.value.has(node.folderId)) {
    openIds.value.delete(node.folderId)
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

// 首次加载 data 时：若 level 0（根层），自动展开并加载子级
watch(
  () => props.data,
  (nodes) => {
    if ((props.level || 0) !== 0 || !nodes?.length) return
    for (const node of nodes) {
      if (!children.value[node.folderId]) {
        // 展开加载
        openIds.value.add(node.folderId)
        listChildren(node.folderId)
          .then((cs) => { children.value[node.folderId] = cs })
          .catch(() => { children.value[node.folderId] = [] })
      }
    }
    openIds.value = new Set(openIds.value)
  },
  { immediate: true }
)

function onDragOver(node: FolderType) {
  dropOverId.value = node.folderId
}

function onDragLeave(node: FolderType) {
  if (dropOverId.value === node.folderId) dropOverId.value = null
}

function onDrop(ev: DragEvent, node: FolderType) {
  dropOverId.value = null
  emit('drop', ev, node)
}
</script>

<style scoped>
.folder-tree {
  font-size: 13.5px;
  text-align: left;
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 6px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;

  &:hover {
    background: #e6f1fc;
  }

  &.active {
    background: #409eff;
    color: white;

    .icon, .arrow { color: white; }
  }

  &.dropTarget {
    background: #d9ecff;
    outline: 1px dashed #409eff;
  }

  .arrow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    color: #909399;
    flex-shrink: 0;

    &.leaf { visibility: hidden; }

    &.expanded {
      transform: rotate(90deg);
    }

    .el-icon {
      transition: transform 0.15s;
    }
  }

  &.expanded .arrow { transform: rotate(90deg); }

  .icon {
    color: #e6a23c;
    flex-shrink: 0;
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
