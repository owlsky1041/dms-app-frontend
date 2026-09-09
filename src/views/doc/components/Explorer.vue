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

    <!-- 右键菜单（自绘，Teleport 到 body） -->
    <DocContextMenu
      :visible="contextMenu.visible"
      :position="contextMenu.position"
      :items="contextMenuOptions"
      @close="contextMenu.visible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
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
import DocContextMenu from './DocContextMenu.vue'

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

/** 右键菜单项（平铺数组供 DocContextMenu 使用） */
const contextMenuOptions = computed(() => {
  const t = contextMenu.target
  if (!t) return []
  const isFolder = t.type === 'folder'
  return [
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

function handleDrop(ev: DragEvent | any, target: Folder) {
  try {
    const raw = (ev as DragEvent).dataTransfer?.getData('application/x-dms-item')
    if (!raw) {
      // 旧格式兼容
      return
    }
    const item = JSON.parse(raw)
    const targetName = target?.folderName || '文件夹'
    if (!item || !item.id) return

    ElMessageBox.confirm(
      `移动 ${item.type === 'folder' ? '文件夹' : '文件'}「${item.name}」到「${targetName}」？`,
      '移动确认', { type: 'info', confirmButtonText: '移动', cancelButtonText: '取消' }
    ).then(async () => {
      if (item.type === 'folder') {
        const { moveFolder } = await import('@/api/doc')
        await moveFolder(item.id, target.folderId)
      } else {
        const { moveFile } = await import('@/api/doc')
        await moveFile(item.id, target.folderId)
      }
      ElMessage.success(`已移动到「${targetName}」`)
      loadCurrentFolder()
    }).catch(() => {})
  } catch (e) {
    ElMessage.error('移动失败')
  }
}

function onUploadComplete() {
  uploadDialogVisible.value = false
  ElMessage.success('上传完成')
  loadCurrentFolder()
}

watch(currentFolderId, async () => {
  await Promise.all([loadCurrentFolder(), loadBreadcrumb()])
})

// ===== 键盘快捷键（Windows 风格） =====
function handleKeydown(e: KeyboardEvent) {
  // 输入框内不触发
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  // Ctrl+A 全选
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    if (currentFiles.value.length) {
      selectedFiles.value = [...currentFiles.value]
    }
    return
  }
  // Delete 删除选中文件
  if (e.key === 'Delete' && selectedFiles.value.length) {
    e.preventDefault()
    handleToolbarAction('delete')
    return
  }
  // F2 重命名当前选中（文件）
  if (e.key === 'F2') {
    e.preventDefault()
    if (selectedFiles.value.length === 1) {
      renameItem({ type: 'file', data: selectedFiles.value[0] })
    } else if (contextMenu.target) {
      renameItem(contextMenu.target)
    }
    return
  }
  // Enter 打开选中（文件预览 / 目录展开已由双击覆盖；这里预览选中文件）
  if (e.key === 'Enter' && selectedFiles.value.length === 1) {
    e.preventDefault()
    handleOpen(selectedFiles.value[0])
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  // 初始加载根文件夹
  if (props.scope === 'my') {
    try {
      const root = await import('@/api/doc').then(m => m.getRootFolder())
      currentFolderId.value = root.folderId
      folderTree.value = [root]  // 左侧树以根为入口，子级由 FolderTree 懒加载展开
      // 同时加载根下的第一层子文件夹也交给 FolderTree 点击时加载
    } catch (e) {
      ElMessage.warning('获取根目录失败')
    }
  } else if (props.scope === 'library') {
    // 资料库是公共文件夹，需要特殊逻辑
    // v1.0 简化：复用当前用户根目录展示
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
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
