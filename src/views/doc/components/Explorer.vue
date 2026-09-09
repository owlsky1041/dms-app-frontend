<template>
  <div class="explorer">
    <!-- 左侧：文件夹树 -->
    <div class="left-panel">
      <FolderTree
        :data="folderTree"
        :selected-id="currentFolderId"
        @select="handleFolderSelect"
        @drop="handleDrop"
      />
    </div>

    <!-- 中间：文件列表 + 面包屑 + 工具栏 -->
    <div class="center-panel">
      <div class="breadcrumb-bar">
        <Breadcrumb :path="breadcrumbPath" @navigate="handleBreadcrumbNav" />
      </div>
      <Toolbar
        :selected-count="selectedFiles.length"
        :view-mode="viewMode"
        @action="handleToolbarAction"
        @view-change="viewMode = $event"
      />
      <FileList
        :folders="currentFolders"
        :files="currentFiles"
        :selection="selectedFiles"
        :view-mode="viewMode"
        @selection-change="selectedFiles = $event"
        @open="handleOpen"
        @contextmenu="handleContextMenu"
        @drop="handleDrop"
        @dblclick="handleDoubleClick"
      />
      <div class="pagination-bar" v-if="total > 0">
        <el-pagination
          v-model:current-page="page.current"
          v-model:page-size="page.size"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="loadCurrentFolder"
          @current-change="loadCurrentFolder"
        />
      </div>
    </div>

    <!-- 右侧：预览/属性 -->
    <div class="right-panel" v-if="activeFile">
      <PreviewPanel :file="activeFile" />
    </div>

    <!-- 上传对话框 -->
    <el-dialog v-model="uploadDialogVisible" title="上传文件" width="640px" :close-on-click-modal="false">
      <Uploader :folder-id="currentFolderId" @complete="onUploadComplete" />
    </el-dialog>

    <!-- 权限对话框 -->
    <PermissionDialog
      v-if="permTarget"
      v-model:visible="permDialogVisible"
      :resource-type="permTarget.type"
      :resource-id="permTarget.id"
      :resource-name="permTarget.name"
      @changed="loadCurrentFolder"
    />

    <!-- 右键菜单 -->
    <vue-context-menu
      :visible="contextMenu.visible"
      :options="contextMenuOptions"
      :position="contextMenu.position"
      @close="contextMenu.visible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listChildren, listFiles, getBreadcrumb,
  createFolder, deleteFolder, deleteFile, renameFile, renameFolder
} from '@/api/doc'
import type { Folder, DocFile } from '@/types/doc'
import FolderTree from './FolderTree.vue'
import Breadcrumb from './Breadcrumb.vue'
import Toolbar from './Toolbar.vue'
import FileList from './FileList.vue'
import PreviewPanel from './PreviewPanel.vue'
import Uploader from './Uploader.vue'
import PermissionDialog from './PermissionDialog.vue'

const props = defineProps<{
  scope: 'my' | 'library' | 'shared' | 'recycle'  // 当前视图
}>()

// ============ 状态 ============

const currentFolderId = ref<number>(0)
const folderTree = ref<Folder[]>([])
const currentFolders = ref<Folder[]>([])
const currentFiles = ref<DocFile[]>([])
const selectedFiles = ref<DocFile[]>([])
const breadcrumbPath = ref<Folder[]>([])
const total = ref(0)
const page = reactive({ current: 1, size: 20 })
const viewMode = ref<'list' | 'large' | 'tile'>('list')
const activeFile = ref<DocFile | null>(null)
const uploadDialogVisible = ref(false)
const permDialogVisible = ref(false)
const permTarget = ref<{ type: 'folder' | 'file'; id: number; name: string } | null>(null)

function openFolderPermission(folderId?: number) {
  permTarget.value = {
    type: 'folder',
    id: folderId ?? currentFolderId.value,
    name: '当前文件夹'
  }
  permDialogVisible.value = true
}

function openFilePermission(file: DocFile) {
  permTarget.value = { type: 'file', id: file.fileId, name: file.fileName }
  permDialogVisible.value = true
}

const contextMenu = reactive({
  visible: false,
  position: { x: 0, y: 0 },
  target: null as { type: 'file' | 'folder'; data: DocFile | Folder } | null
})

const contextMenuOptions = computed(() => {
  const t = contextMenu.target
  if (!t) return []
  const isFolder = t.type === 'folder'
  return {
    items: [
      { label: isFolder ? '打开' : '预览', icon: 'View', onClick: () => handleOpen(t.data as any) },
      { label: '下载', icon: 'Download', onClick: () => downloadFile(t.data as any), disabled: isFolder },
      { label: '重命名', icon: 'Edit', onClick: () => renameItem(t) },
      { divider: true },
      { label: '复制', icon: 'Copy', onClick: () => ElMessage.info('复制（待实现）') },
      { label: '剪切', icon: 'Scissor', onClick: () => ElMessage.info('剪切（待实现）') },
      { divider: true },
      { label: '共享给...', icon: 'Share', onClick: () => ElMessage.info('共享（待实现）') },
      {
        label: '权限设置', icon: 'Lock',
        onClick: () => isFolder
          ? openFolderPermission((t.data as Folder).folderId)
          : openFilePermission(t.data as DocFile)
      },
      { divider: true },
      { label: isFolder ? '删除文件夹' : '删除', icon: 'Delete', onClick: () => deleteItem(t) },
      { label: '属性', icon: 'InfoFilled', onClick: () => ElMessage.info('属性（待实现）') }
    ]
  }
})

// ============ 加载 ============

async function loadCurrentFolder() {
  if (currentFolderId.value === 0) return
  const [folders, files] = await Promise.all([
    listChildren(currentFolderId.value).catch(() => []),
    listFiles(currentFolderId.value, page.current, page.size).catch(() => ({ records: [], total: 0 }))
  ])
  currentFolders.value = folders
  currentFiles.value = files.records
  total.value = files.total
}

async function loadBreadcrumb() {
  if (currentFolderId.value === 0) {
    breadcrumbPath.value = []
    return
  }
  breadcrumbPath.value = await getBreadcrumb(currentFolderId.value)
}

function handleFolderSelect(folderId: number) {
  currentFolderId.value = folderId
  page.current = 1
}

function handleBreadcrumbNav(folderId: number) {
  currentFolderId.value = folderId
}

async function handleDoubleClick(item: { type: 'folder' | 'file'; data: Folder | DocFile }) {
  if (item.type === 'folder') {
    currentFolderId.value = (item.data as Folder).folderId
  } else {
    activeFile.value = item.data as DocFile
  }
}

async function handleOpen(item: any) {
  if ('folderId' in item && !('fileSize' in item)) {
    currentFolderId.value = item.folderId
  } else {
    activeFile.value = item
  }
}

function handleContextMenu(event: MouseEvent, item: any) {
  event.preventDefault()
  contextMenu.visible = true
  contextMenu.position = { x: event.clientX, y: event.clientY }
  contextMenu.target = item
}

function handleToolbarAction(action: string) {
  switch (action) {
    case 'newFolder':
      promptCreateFolder()
      break
    case 'upload':
      uploadDialogVisible.value = true
      break
    case 'refresh':
      loadCurrentFolder()
      break
    case 'permission':
      openFolderPermission(currentFolderId.value)
      break
    case 'delete':
      if (selectedFiles.value.length > 0) {
        ElMessageBox.confirm(`确定删除 ${selectedFiles.value.length} 项?`, '确认', {
          type: 'warning'
        }).then(async () => {
          await Promise.all(selectedFiles.value.map(f => deleteFile(f.fileId)))
          ElMessage.success('删除成功')
          selectedFiles.value = []
          loadCurrentFolder()
        }).catch(() => {})
      }
      break
  }
}

async function promptCreateFolder() {
  try {
    const { value: name } = await ElMessageBox.prompt('请输入文件夹名', '新建文件夹', {
      confirmButtonText: '创建',
      cancelButtonText: '取消'
    })
    if (name?.trim()) {
      await createFolder(currentFolderId.value, name.trim())
      ElMessage.success('创建成功')
      loadCurrentFolder()
    }
  } catch {}
}

async function renameItem(target: any) {
  const oldName = target.data.fileName || target.data.folderName
  try {
    const { value: name } = await ElMessageBox.prompt('新名称', '重命名', {
      inputValue: oldName
    })
    if (name?.trim() && name !== oldName) {
      if (target.type === 'file') {
        await renameFile(target.data.fileId, name.trim())
      } else {
        await renameFolder(target.data.folderId, name.trim())
      }
      loadCurrentFolder()
    }
  } catch {}
}

async function deleteItem(target: any) {
  try {
    await ElMessageBox.confirm(`确定删除 "${target.data.fileName || target.data.folderName}"?`, '确认', {
      type: 'warning'
    })
    if (target.type === 'file') {
      await deleteFile(target.data.fileId)
    } else {
      await deleteFolder(target.data.folderId)
    }
    ElMessage.success('删除成功')
    loadCurrentFolder()
  } catch {}
}

function downloadFile(file: DocFile) {
  // 带 token 下载
  import('@/api/http').then(async ({ default: http }) => {
    try {
      const resp = await http.get(`/api/doc/files/${file.fileId}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(resp.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.fileName || 'download'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('download failed', e)
    }
  })
}

function handleDrop(target: Folder, draggedIds: number[]) {
  ElMessage.info(`拖拽 ${draggedIds.length} 项到 ${target.folderName}（待实现移动逻辑）`)
}

function onUploadComplete() {
  uploadDialogVisible.value = false
  ElMessage.success('上传完成')
  loadCurrentFolder()
}

watch(currentFolderId, async () => {
  await Promise.all([loadCurrentFolder(), loadBreadcrumb()])
})

onMounted(async () => {
  // 初始加载根文件夹
  if (props.scope === 'my') {
    try {
      const root = await import('@/api/doc').then(m => m.getRootFolder())
      currentFolderId.value = root.folderId
    } catch (e) {
      ElMessage.warning('获取根目录失败')
    }
  } else if (props.scope === 'library') {
    // 资料库是公共文件夹，需要特殊逻辑
    // v1.0 简化：复用当前用户根目录展示
  }
})
</script>

<style lang="scss" scoped>
.explorer {
  display: flex;
  height: calc(100vh - 100px);
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.left-panel {
  width: 280px;
  border-right: 1px solid #ebeef5;
  padding: 12px;
  overflow: auto;
  background: #fafbfc;
}

.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.breadcrumb-bar {
  padding: 8px 16px;
  border-bottom: 1px solid #ebeef5;
}

.pagination-bar {
  padding: 8px 16px;
  display: flex;
  justify-content: flex-end;
}

.right-panel {
  width: 360px;
  border-left: 1px solid #ebeef5;
  background: #fafbfc;
}
</style>
