<template>
  <el-dialog
    :model-value="visible"
    title="移动到"
    width="420px"
    @update:model-value="(v) => $emit('update:visible', v)"
  >
    <p class="tip">将 {{ itemCount }} 项移动到目标文件夹：</p>
    <!--
      用 key 强制重挂载：el-tree 的 lazy 模式只在挂载时向 load 要根节点，
      重挂载才能保证每次打开都拿到最新的目录结构（新建的文件夹立刻可选）。
    -->
    <el-tree
      :key="treeKey"
      ref="treeRef"
      :props="treeProps"
      node-key="folderId"
      :expand-on-click-node="false"
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
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Folder } from '@element-plus/icons-vue'
import { listChildren, moveFolder, moveFile } from '@/api/doc'

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
const targetFolderId = ref<number | null>(null)
const itemCount = props.items.length
const treeProps = { label: 'folderName', children: 'children' }
/** 每次打开自增，用于强制重建 el-tree */
const treeKey = ref(0)

/**
 * 打开时重置选择并重建目录树
 *
 * 用 watch 而不是 el-dialog 的 @open：Explorer 是用 v-if 创建本组件的
 * （右击菜单里先 moveItems = [...] 再 moveDialogVisible = true），
 * 组件创建时 visible 已经为 true，@open 不会触发——
 * 结果就是「第一次点移动到是空目录，关掉再点一次才有」。
 */
watch(() => props.visible, (v) => {
  if (!v) return
  targetFolderId.value = null
  treeKey.value++
}, { immediate: true })

/**
 * 懒加载目录节点
 *
 * node.level === 0 是树根，这里返回顶层文档区；其余按 folderId 取子目录。
 */
async function loadNode(node: any, resolve: (data: any[]) => void) {
  try {
    const isRoot = node?.level === 0
    const parentId = isRoot ? 0 : node?.data?.folderId
    if (parentId === undefined || parentId === null) {
      resolve([])
      return
    }
    const children = await listChildren(parentId)
    if (isRoot && !children.length) {
      ElMessage.warning('暂无可选的目标目录')
    }
    resolve(children.map((c: any) => ({
      folderId: c.folderId,
      folderName: c.folderName
    })))
  } catch (e) {
    console.error('[MoveDialog] 加载目录失败', e)
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
        if (String(it.folderId) === String(target)) continue
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
