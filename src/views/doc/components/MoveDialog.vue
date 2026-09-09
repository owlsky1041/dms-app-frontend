<template>
  <el-dialog
    :model-value="visible"
    title="移动到"
    width="420px"
    @update:model-value="(v) => $emit('update:visible', v)"
    @open="loadRoot"
  >
    <p class="tip">将 {{ itemCount }} 项移动到目标文件夹：</p>
    <el-tree
      ref="treeRef"
      :data="treeData"
      :props="treeProps"
      node-key="folderId"
      :expand-on-click-node="false"
      :default-expand-all="false"
      lazy
      :load="loadNode"
      highlight-current
      @current-change="onSelect"
    >
      <template #default="{ data }">
        <span class="tree-item">
          <el-icon color="#e6a23c"><Folder /></el-icon>
          <span>{{ data.folderName }}</span>
        </span>
      </template>
    </el-tree>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!targetFolderId" @click="doMove">移动到这里</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Folder } from '@element-plus/icons-vue'
import { listChildren, getRootFolder, moveFolder, moveFile } from '@/api/doc'

const props = defineProps<{
  visible: boolean
  sourceFolderId: number          // 来源目录（禁止移入自身/子树）
  items: any[]                    // 待移动项
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'moved'): void
}>()

const treeRef = ref()
const treeData = ref<any[]>([])
const targetFolderId = ref<number | null>(null)
const itemCount = props.items.length
const treeProps = { label: 'folderName', children: 'children', isLeaf: 'leaf' }

/** dialog 打开时加载根节点 */
async function loadRoot() {
  targetFolderId.value = null
  treeData.value = []
  try {
    const api = await import('@/api/doc')
    const roots = await api.listChildren(0)
    const my = roots.find((r: any) => r.folderName === '我的文档') || roots[0]
    const base = my || await api.getRootFolder()
    treeData.value = [{
      folderId: base.folderId,
      folderName: base.folderName,
      leaf: false
    }]
  } catch (e) {
    console.error('[MoveDialog] loadRoot 失败', e)
    ElMessage.error('加载目录树失败')
  }
}

/** 懒加载子节点（el-tree lazy） */
async function loadNode(node: any, resolve: (data: any[]) => void) {
  const folderId = node?.data?.folderId
  // 根虚拟节点直接加载根子级
  if (!folderId) {
    resolve([...treeData.value])
    return
  }
  try {
    const children = await listChildren(folderId)
    // 过滤：禁止选来源目录本身作为目标时拖入自身（仍可显示但不可作为目标）
    resolve(children.map((c: any) => ({
      folderId: c.folderId,
      folderName: c.folderName,
      leaf: false
    })))
  } catch (e) {
    console.error('[MoveDialog] loadNode 失败', folderId, e)
    resolve([])
  }
}

function onSelect(data: any) {
  if (data?.folderId && data.folderId !== props.sourceFolderId) {
    targetFolderId.value = data.folderId
  } else {
    targetFolderId.value = null
  }
}

async function doMove() {
  const target = targetFolderId.value
  if (!target) return
  try {
    for (const it of props.items) {
      const isFolder = it.__type === 'folder' || (it.folderId != null && it.fileId == null)
      if (isFolder) {
        if (Number(it.folderId) === Number(target)) continue
        await moveFolder(it.folderId, target)
      } else {
        await moveFile(it.fileId, target)
      }
    }
    ElMessage.success('移动完成')
    emit('update:visible', false)
    emit('moved')
  } catch (e: any) {
    ElMessage.error('移动失败：' + (e?.message || '未知错误'))
    console.error('[MoveDialog] doMove 失败', e)
  }
}
</script>

<style scoped>
.tip { margin: 0 0 12px; color: #606266; font-size: 13px; }
.tree-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
</style>
