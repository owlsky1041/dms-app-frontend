<template>
  <el-dialog
    :model-value="visible"
    title="移动到"
    width="420px"
    @update:model-value="(v) => $emit('update:visible', v)"
    @open="loadTree"
  >
    <p class="tip">将 {{ itemCount }} 项移动到目标文件夹：</p>
    <el-tree
      ref="treeRef"
      :data="treeData"
      :props="{ label: 'folderName', children: 'children' }"
      node-key="folderId"
      default-expand-all
      highlight-current
      :expand-on-click-node="false"
      @current-change="onSelect"
    />
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!targetFolderId" @click="doMove">移动到这里</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { listChildren, getRootFolder, moveFolder, moveFile } from '@/api/doc'
import type { Folder } from '@/types/doc'

const props = defineProps<{
  visible: boolean
  sourceFolderId: number          // 来源目录（防止移回自身）
  items: any[]                    // 待移动项：[{__type, folderId|fileId, name}]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'moved'): void
}>()

const treeRef = ref()
const treeData = ref<any[]>([])
const targetFolderId = ref<number | null>(null)
const itemCount = () => props.items.length

/** 构建目录树：根 + 递归子级 */
async function loadTree() {
  targetFolderId.value = null
  try {
    const api = await import('@/api/doc')
    const roots = await api.listChildren(0)
    // 找到"我的文档"根（或第一个根）
    const my = roots.find((r: Folder) => r.folderName === '我的文档') || roots[0]
    if (my) {
      treeData.value = [await buildNode(my)]
    } else {
      const root = await api.getRootFolder()
      treeData.value = [await buildNode(root)]
    }
  } catch (e) {
    treeData.value = []
  }
}

/** 递归构建 el-tree 节点（懒加载子级） */
async function buildNode(folder: Folder): Promise<any> {
  const node: any = { folderId: folder.folderId, folderName: folder.folderName, children: [] }
  // 排除来源目录自身（避免移入自己）
  const disallowSelf = folder.folderId === props.sourceFolderId
  if (!disallowSelf) {
    try {
      const children = await listChildren(folder.folderId)
      node.children = await Promise.all(children.map((c: Folder) => buildNode(c)))
    } catch { node.children = [] }
  }
  return node
}

function onSelect(data: any) {
  if (data?.folderId && data.folderId !== props.sourceFolderId) {
    targetFolderId.value = data.folderId
  } else {
    targetFolderId.value = null
  }
}

async function doMove() {
  if (!targetFolderId.value) return
  const target = targetFolderId.value
  try {
    for (const it of props.items) {
      const isFolder = it.__type === 'folder' || (it.folderId != null && it.fileId == null)
      if (isFolder) {
        if (it.folderId === target) continue
        await moveFolder(it.folderId, target)
      } else {
        await moveFile(it.fileId, target)
      }
    }
    ElMessage.success('移动完成')
    emit('update:visible', false)
    emit('moved')
  } catch (e: any) {
    ElMessage.error('移动失败：' + (e?.message || ''))
  }
}

onMounted(() => { if (props.visible) loadTree() })
</script>

<style scoped>
.tip { margin: 0 0 12px; color: #606266; font-size: 13px; }
</style>
