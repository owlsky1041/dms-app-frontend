<template>
  <div class="explorer">
    <!-- 左侧：文件夹树（key 变化时强制重建刷新） -->
    <div class="left-panel">
      <FolderTree
        :key="treeRefreshKey"
        :data="folderTree"
        :selected-id="currentFolderId"
        @select="handleFolderSelect"
        @drop="handleDrop"
      />
    </div>

    <!-- 中间：文件列表 + 面包屑 + 工具栏 -->
    <div class="center-panel">
      <div class="breadcrumb-bar" v-if="!search.active">
        <template v-if="currentFolderId === 0">
          <span class="root-label">
            <el-icon><FolderIcon /></el-icon>
            全部文档
            <span class="root-hint">（公司文档根目录 · 点击下方文档区进入）</span>
          </span>
        </template>
        <Breadcrumb v-else :path="breadcrumbPath" @navigate="handleBreadcrumbNav" />
      </div>
      <div class="search-bar" v-else>
        <el-icon><Search /></el-icon>
        <span class="search-text">
          搜索「<b>{{ search.keyword }}</b>」—— 命中 <b>{{ search.results.length }}</b> 个文件
          <span class="search-hint">（匹配文件名与 PDF/Office 正文内容）</span>
        </span>
        <el-button size="small" @click="clearSearch">返回目录</el-button>
      </div>
      <Toolbar
        v-if="!search.active"
        :selected-count="selectedItems.length"
        :view-mode="viewMode"
        :clipboard-count="clipboard.files.length"
        @action="handleToolbarAction"
        @view-change="viewMode = $event"
      />
      <FileList
        v-loading="search.loading"
        :folders="search.active ? [] : currentFolders"
        :files="search.active ? search.results : currentFiles"
        :selection="selectedItems"
        :view-mode="viewMode"
        @selection-change="selectedItems = $event"
        @open="handleOpen"
        @contextmenu="handleContextMenu"
        @drop="handleDrop"
        @dblclick="handleDoubleClick"
      />
      <div class="pagination-bar" v-if="!search.active && total > 0">
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

    <!-- 文件预览弹窗（双击文件打开，不再占用右侧栏） -->
    <FilePreviewDialog
      v-model:visible="previewVisible"
      :file="activeFile"
      @rename="onActiveRename"
      @delete="onActiveDelete"
    />

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

    <!-- 移动对话框 -->
    <MoveDialog
      v-if="moveItems.length"
      v-model:visible="moveDialogVisible"
      :source-folder-id="currentFolderId"
      :items="moveItems"
      @moved="onMoveDone"
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
import { useClipboardStore } from '@/stores/clipboard'
import { useRoute, useRouter } from 'vue-router'
import { Search, Folder as FolderIcon } from '@element-plus/icons-vue'
import {
  listChildren, listFiles, getBreadcrumb, searchFiles, checkPerm, getDeptArea,
  createFolder, deleteFolder, deleteFile, renameFile, renameFolder,
  copyFile, batchMoveFiles
} from '@/api/doc'
import type { Folder, DocFile } from '@/types/doc'
import FolderTree from './FolderTree.vue'
import Breadcrumb from './Breadcrumb.vue'
import Toolbar from './Toolbar.vue'
import FileList from './FileList.vue'
import FilePreviewDialog from './FilePreviewDialog.vue'
import Uploader from './Uploader.vue'
import PermissionDialog from './PermissionDialog.vue'
import MoveDialog from './MoveDialog.vue'
import DocContextMenu from './DocContextMenu.vue'

const props = defineProps<{
  scope: 'company' | 'library' | 'recycle'  // 当前视图（company=公司全部文档顶层）
}>()

// ============ 状态 ============

const currentFolderId = ref<number>(0)
const clipboard = useClipboardStore()
const folderTree = ref<Folder[]>([])
const treeRefreshKey = ref(0)
const currentFolders = ref<Folder[]>([])
const currentFiles = ref<DocFile[]>([])
/** 选中项：文件夹 + 文件混合（含 __type 标记） */
const selectedItems = ref<any[]>([])
const breadcrumbPath = ref<Folder[]>([])
const total = ref(0)
const page = reactive({ current: 1, size: 20 })
const viewMode = ref<'list' | 'large' | 'tile'>('list')
const activeFile = ref<DocFile | null>(null)
/** 预览弹窗可见性 */
const previewVisible = ref(false)
const uploadDialogVisible = ref(false)
const permDialogVisible = ref(false)
const permTarget = ref<{ type: 'folder' | 'file'; id: number; name: string } | null>(null)
const moveDialogVisible = ref(false)
const moveItems = ref<any[]>([])

const route = useRoute()
const router = useRouter()
/** 全局搜索结果视图 */
const search = reactive({
  active: false,
  keyword: '',
  loading: false,
  results: [] as DocFile[]
})

/** 完全控制位（128）：只有具备该位才能查看/变更授权 */
const FULL_CONTROL = 128

/**
 * 打开权限设置前先校验「完全控制」权限
 * 授权规则：完全控制归文档区所有者；上传者只拿到编辑权，不能分配权限
 */
async function ensureFullControl(type: 'folder' | 'file', id: number): Promise<boolean> {
  try {
    const flags: any = await checkPerm(type, id)
    if ((Number(flags) & FULL_CONTROL) === 0) {
      ElMessage.warning('无完全控制权限，无法分配权限（完全控制归文档区所有者）')
      return false
    }
    return true
  } catch (e: any) {
    ElMessage.error(`权限校验失败：${e?.message || e?.msg || '未知错误'}`)
    return false
  }
}

async function openFolderPermission(folderId?: number) {
  const id = folderId ?? currentFolderId.value
  if (id === 0) {
    ElMessage.warning('请在具体文档区/文件夹上设置权限')
    return
  }
  if (!(await ensureFullControl('folder', id))) return
  permTarget.value = { type: 'folder', id, name: '当前文件夹' }
  permDialogVisible.value = true
}

async function openFilePermission(file: DocFile) {
  if (!(await ensureFullControl('file', file.fileId))) return
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
  const file = t.data as DocFile
  return [
    { label: isFolder ? '打开' : '预览', icon: 'View', onClick: () => handleOpen(t.data as any) },
    { label: '下载', icon: 'Download', onClick: () => downloadFile(t.data as any), disabled: isFolder },
    { label: '重命名', icon: 'Edit', onClick: () => renameItem(t) },
    { divider: true },
    {
      label: '复制', icon: 'Copy',
      onClick: () => clipboard.copy([file], currentFolderId.value),
      disabled: isFolder
    },
    {
      label: '剪切', icon: 'Scissor',
      onClick: () => clipboard.cut([file], currentFolderId.value),
      disabled: isFolder
    },
    { label: '粘贴', icon: 'CopyDocument', onClick: () => doPaste(), disabled: clipboard.isEmpty() },
    { divider: true },
    { label: '共享给...', icon: 'Share', onClick: () => ElMessage.info('共享（待实现）') },
    {
      label: '移动到...', icon: 'FolderOpened',
      onClick: () => {
        moveItems.value = [t.data]
        moveDialogVisible.value = true
      }
    },
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
  // 顶层（folderId=0）不是真实文件夹：只列出公司各文档区，文件必然为 0
  if (currentFolderId.value === 0) {
    currentFolders.value = await listChildren(0).catch(() => [])
    currentFiles.value = []
    total.value = 0
    return
  }
  const [folders, files] = await Promise.all([
    listChildren(currentFolderId.value).catch(() => []),
    listFiles(currentFolderId.value, page.current, page.size).catch(() => ({ records: [], total: 0 }))
  ])
  currentFolders.value = folders
  currentFiles.value = files.records
  total.value = files.total
}

/** 全局搜索：文件名 + PDF/Office 正文（后端 ILIKE，支持中文） */
async function runSearch(keyword: string) {
  const kw = (keyword || '').trim()
  if (!kw) {
    clearSearch()
    return
  }
  search.keyword = kw
  search.active = true
  search.loading = true
  selectedItems.value = []
  activeFile.value = null
  try {
    const res: any = await searchFiles(kw, 100)
    search.results = Array.isArray(res) ? res : (res?.records || [])
    if (search.results.length === 0) {
      ElMessage.info(`未找到与「${kw}」匹配的文件`)
    }
  } catch (e: any) {
    search.results = []
    ElMessage.error(`搜索失败：${e?.message || e?.msg || '未知错误'}`)
  } finally {
    search.loading = false
  }
}

function clearSearch() {
  search.active = false
  search.keyword = ''
  search.results = []
  search.loading = false
  if (route.query.q) {
    router.push({ name: route.name as string, query: {} })
  }
}

/** 从搜索结果跳到文件所在文件夹 */
async function locateFolder(file: DocFile) {
  if (file.folderId == null) return
  clearSearch()
  currentFolderId.value = file.folderId
  await loadBreadcrumb()
  await loadCurrentFolder()
}

/** 文件夹结构变更后刷新左侧树 */
function refreshTree() {
  treeRefreshKey.value++
}

async function loadBreadcrumb() {
  if (currentFolderId.value === 0) {
    breadcrumbPath.value = []
    return
  }
  breadcrumbPath.value = await getBreadcrumb(currentFolderId.value)
}

function handleFolderSelect(folderId: number) {
  if (search.active) clearSearch()
  currentFolderId.value = folderId
  page.current = 1
}

function handleBreadcrumbNav(folderId: number) {
  if (search.active) clearSearch()
  currentFolderId.value = folderId
}

async function handleDoubleClick(item: { type: 'folder' | 'file'; data: Folder | DocFile }) {
  if (item.type === 'folder') {
    currentFolderId.value = (item.data as Folder).folderId
  } else {
    // 文件：弹出预览窗口
    openPreview(item.data as DocFile)
  }
}

/** 打开预览弹窗 */
function openPreview(file: DocFile) {
  activeFile.value = file
  previewVisible.value = true
}

async function handleOpen(item: any) {
  if ('folderId' in item && !('fileSize' in item)) {
    if (search.active) clearSearch()
    currentFolderId.value = item.folderId
  } else {
    openPreview(item)
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
      if (currentFolderId.value === 0) {
        ElMessage.warning('请先进入一个文件夹再上传（当前为文档根目录）')
        break
      }
      uploadDialogVisible.value = true
      break
    case 'refresh':
      loadCurrentFolder()
      break
    case 'permission':
      openFolderPermission(currentFolderId.value)
      break
    case 'move':
      if (selectedItems.value.length > 0) {
        moveItems.value = [...selectedItems.value]
        moveDialogVisible.value = true
      }
      break
    case 'paste':
      doPaste()
      break
    case 'delete':
      if (selectedItems.value.length > 0) {
        const itemCount = selectedItems.value.length
        ElMessageBox.confirm(`确定删除 ${itemCount} 项?`, '确认', {
          type: 'warning'
        }).then(async () => {
          const folders = selectedItems.value.filter((x: any) =>
            (x.__type === 'folder') || (x.folderId != null && x.fileId == null))
          const files = selectedItems.value.filter((x: any) =>
            (x.__type === 'file') || (x.fileId != null && x.folderId == null))
          for (const f of folders) await deleteFolder(f.folderId)
          for (const f of files) await deleteFile(f.fileId)
          ElMessage.success('删除成功')
          selectedItems.value = []
          loadCurrentFolder()
          refreshTree()
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
      refreshTree()
    }
  } catch {}
}

async function renameItem(target: any) {
  const data = target?.data || target || {}
  const isFolderItem = target?.type === 'folder' || (data.folderId != null && data.fileId == null)
  const oldName = data.fileName || data.folderName || ''
  const id = isFolderItem ? data.folderId : data.fileId
  if (id == null) {
    ElMessage.warning('无法识别要重命名的对象')
    return
  }
  try {
    const { value: name } = await ElMessageBox.prompt('新名称', '重命名', {
      inputValue: oldName
    })
    if (name?.trim() && name !== oldName) {
      if (isFolderItem) {
        await renameFolder(id, name.trim())
        refreshTree()
      } else {
        await renameFile(id, name.trim())
      }
      loadCurrentFolder()
    }
  } catch {}
}

async function deleteItem(target: any) {
  const data = target?.data || target || {}
  const isFolderItem = target?.type === 'folder' || (data.folderId != null && data.fileId == null)
  const name = data.folderName || data.fileName || '该项目'
  const id = isFolderItem ? data.folderId : data.fileId
  if (id == null) {
    console.warn('[deleteItem] 无法识别对象', target)
    ElMessage.warning('无法识别要删除的对象')
    return
  }
  try {
    await ElMessageBox.confirm(`确定删除 "${name}"?`, '确认', { type: 'warning' })
  } catch {
    return // 用户取消
  }
  try {
    if (isFolderItem) {
      await deleteFolder(id)
      refreshTree()
    } else {
      await deleteFile(id)
    }
    ElMessage.success('删除成功')
    if (activeFile.value?.fileId === id) {
      activeFile.value = null
      previewVisible.value = false
    }
    loadCurrentFolder()
  } catch (e: any) {
    console.error('[deleteItem] 删除失败', e)
    ElMessage.error(`删除失败：${e?.message || '未知错误'}`)
  }
}

/** 预览面板：重命名当前文件 */
async function onActiveRename() {
  if (!activeFile.value) return
  await renameItem({ type: 'file', data: activeFile.value })
}

/** 预览面板：删除当前文件 */
async function onActiveDelete() {
  if (!activeFile.value) return
  await deleteItem({ type: 'file', data: activeFile.value })
  activeFile.value = null
}

function downloadFile(file: DocFile) {
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
        refreshTree()
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

/**
 * 粘贴剪贴板文件到当前文件夹
 * 复制 → copyFile（新记录引用同一对象）；剪切 → batchMove 到当前目录并清空剪贴板
 */
async function doPaste() {
  if (clipboard.isEmpty()) {
    ElMessage.info('剪贴板为空')
    return
  }
  const ids = clipboard.files.map(f => f.fileId)
  try {
    if (clipboard.mode === 'cut') {
      await batchMoveFiles(ids, currentFolderId.value)
      ElMessage.success(`已移动 ${ids.length} 个文件`)
    } else {
      for (const id of ids) {
        await copyFile(id, currentFolderId.value)
      }
      ElMessage.success(`已复制 ${ids.length} 个文件`)
    }
    clipboard.clear()
    loadCurrentFolder()
  } catch (e) {
    ElMessage.error('粘贴失败')
  }
}

function onUploadComplete() {
  uploadDialogVisible.value = false
  ElMessage.success('上传完成')
  loadCurrentFolder()
}

/** 移动完成：清空选中，刷新列表与树 */
function onMoveDone() {
  selectedItems.value = []
  moveItems.value = []
  loadCurrentFolder()
  refreshTree()
}

watch(currentFolderId, async () => {
  await Promise.all([loadCurrentFolder(), loadBreadcrumb()])
})

// ===== 键盘快捷键（Windows 风格） =====
function handleKeydown(e: KeyboardEvent) {
  // 输入框内不触发
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  // Ctrl+A 全选（文件夹 + 文件）
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    const all = [
      ...currentFolders.value.map((f: any) => ({ ...f, __type: 'folder' })),
      ...currentFiles.value.map((f: any) => ({ ...f, __type: 'file' }))
    ]
    if (all.length) selectedItems.value = all
    return
  }
  // Delete 删除选中文件
  if (e.key === 'Delete' && selectedItems.value.length) {
    e.preventDefault()
    handleToolbarAction('delete')
    return
  }
  // F2 重命名当前选中（文件或文件夹）
  if (e.key === 'F2') {
    e.preventDefault()
    if (selectedItems.value.length === 1) {
      const it: any = selectedItems.value[0]
      const isF = it.__type === 'folder' || (it.folderId != null && it.fileId == null)
      renameItem({ type: isF ? 'folder' : 'file', data: it })
    } else if (contextMenu.target) {
      renameItem(contextMenu.target)
    }
    return
  }
  // Enter 打开选中（文件夹进入 / 文件预览）
  if (e.key === 'Enter' && selectedItems.value.length === 1) {
    e.preventDefault()
    handleOpen(selectedItems.value[0])
  }
}

// 顶部搜索框 -> route.query.q（输入即搜 / 回车搜）
watch(() => route.query.q, (q) => {
  if (typeof q === 'string' && q.trim()) {
    runSearch(q)
  } else if (search.active) {
    search.active = false
    search.keyword = ''
    search.results = []
  }
}, { immediate: true })

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  if (props.scope === 'company') {
    // 公司全部文档：顶层 = parentId 0 下各文档区
    try {
      currentFolderId.value = 0
      folderTree.value = await listChildren(0)
      await loadCurrentFolder()
      await loadBreadcrumb()
    } catch (e) {
      ElMessage.warning('获取文档目录失败')
    }
  } else if (props.scope === 'library') {
    // 部门文档区：按「第一个顶层文档区」定位，不依赖目录名称（目录可被重命名）
    try {
      const roots = await listChildren(0)
      const deptArea = await getDeptArea()
      folderTree.value = roots
      if (deptArea) {
        currentFolderId.value = deptArea.folderId
        await loadCurrentFolder()
        await loadBreadcrumb()
      } else {
        currentFolderId.value = 0
        currentFolders.value = []
        currentFiles.value = []
        ElMessage.info('暂无文档区，请联系管理员创建')
      }
    } catch (e) {
      ElMessage.warning('获取部门文档区失败')
    }
  }
  // recycle 使用独立页面，不在此加载
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

.root-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #303133;

  .root-hint {
    font-weight: 400;
    font-size: 12px;
    color: #909399;
  }
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin: 8px 12px;
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 6px;
  font-size: 13px;
  color: #303133;

  .search-text {
    flex: 1;
  }
  .search-hint {
    color: #909399;
    font-size: 12px;
  }
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

</style>
