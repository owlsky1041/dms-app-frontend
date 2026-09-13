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
        :clipboard-count="clipboard.count"
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

    <!-- 图片查看：PhotoSwipe 图集（可翻阅整个目录的图片） -->
    <ImageGallery ref="galleryRef" @download="onGalleryDownload" />

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

    <!-- 共享给…（快速授权） -->
    <ShareDialog
      v-if="shareTarget"
      v-model="shareVisible"
      :resource-type="shareTarget.type"
      :resource-id="shareTarget.id"
      :resource-name="shareTarget.name"
      @changed="loadCurrentFolder"
    />

    <!-- 属性 -->
    <PropertiesDialog
      v-model="propsVisible"
      :target="propsTarget"
      :target-type="propsType"
      :location-path="locationPathText"
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
import { useUserStore } from '@/stores/user'
import { useRoute, useRouter } from 'vue-router'
import { Search, Folder as FolderIcon } from '@element-plus/icons-vue'
import {
  listChildren, listFiles, getBreadcrumb, searchFiles, checkPerm,
  createFolder, deleteFolder, deleteFile, renameFile, renameFolder,
  copyFile, batchMoveFiles, copyFolder, mergeIntoFolder, moveFolder,
  getFolderZipPlan, getSelectionZipPlan,
  submitFolderExport, submitSelectionExport
} from '@/api/doc'
import { PermissionFlag, type Folder, type DocFile } from '@/types/doc'
import { downloadAsFile, downloadFileById } from '@/utils/download'
import { notifyError } from '@/api/http'
import FolderTree from './FolderTree.vue'
import Breadcrumb from './Breadcrumb.vue'
import Toolbar from './Toolbar.vue'
import FileList from './FileList.vue'
import FilePreviewDialog from './FilePreviewDialog.vue'
import ImageGallery, { type GalleryItem } from './ImageGallery.vue'
import { getFileMediaBatch } from '@/api/doc'
import Uploader from './Uploader.vue'
import PermissionDialog from './PermissionDialog.vue'
import ShareDialog from './ShareDialog.vue'
import PropertiesDialog from './PropertiesDialog.vue'
import MoveDialog from './MoveDialog.vue'
import DocContextMenu from './DocContextMenu.vue'

const props = defineProps<{
  scope: 'company' | 'recycle'  // 当前视图（company=公司全部文档顶层）
}>()

// ============ 状态 ============

const currentFolderId = ref<number>(0)
const clipboard = useClipboardStore()
const userStore = useUserStore()
/**
 * 能力闸门：当前账号能不能做文档授权（权限设置 / 共享给…）
 *
 * 权限串沿用「全部文档」菜单下早就存在的两个按钮——「权限分配」doc:perm:grant
 * 与「完全控制」doc:perm:full（后端注解是同样的 OR 语义）。
 * 内置超管依然是超管：hasPermission 对 ['*:*:*'] 一律放行，所以不用再单独判断 isSuperAdmin。
 *
 * 注意这只是"能不能做"；在某个目录/文件上"能不能做"还要看有没有「完全控制」位，
 * 由 ensureFullControl() 在真正点开时向后端问一次（范围闸门）。
 */
const canConfigPermission = computed(() =>
  userStore.hasPermission(['doc:perm:grant', 'doc:perm:full'])
)
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

/** PhotoSwipe 图集：图片不走预览弹窗，直接开全屏图集 */
const galleryRef = ref<InstanceType<typeof ImageGallery> | null>(null)
const uploadDialogVisible = ref(false)
const permDialogVisible = ref(false)
const permTarget = ref<{ type: 'folder' | 'file'; id: number; name: string } | null>(null)
const moveDialogVisible = ref(false)
const moveItems = ref<any[]>([])
/** 共享给… 弹窗 */
const shareVisible = ref(false)
const shareTarget = ref<{ type: 'folder' | 'file'; id: number; name: string } | null>(null)
/** 属性弹窗 */
const propsVisible = ref(false)
const propsTarget = ref<DocFile | Folder | null>(null)
const propsType = ref<'file' | 'folder'>('file')

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
 * 范围闸门：打开权限设置前先确认对目标资源有「完全控制」位
 *
 * 授权规则：完全控制位归文档区所有者，也可以由超管按档位授予别人；
 * 上传者只拿到编辑权，不能分配权限（否则拿到编辑权就能给自己授完全控制）。
 */
async function ensureFullControl(type: 'folder' | 'file', id: number): Promise<boolean> {
  try {
    const flags: any = await checkPerm(type, id)
    if ((Number(flags) & FULL_CONTROL) === 0) {
      ElMessage.warning('你在该目录/文件上没有「完全控制」权限，无法分配权限（完全控制 = 读写 + 下载 + 授权）')
      return false
    }
    return true
  } catch (e: any) {
    ElMessage.error(`权限校验失败：${e?.message || e?.msg || '未知错误'}`)
    return false
  }
}

async function openFolderPermission(folderId?: number, folderName?: string) {
  const id = folderId ?? currentFolderId.value
  if (id === 0) {
    ElMessage.warning('请在具体文档区/文件夹上设置权限')
    return
  }
  if (!(await ensureFullControl('folder', id))) return
  // 标题必须显示真实文件夹名：之前这里写死了 "当前文件夹"，
  // 于是弹窗标题变成「文件夹权限 - 当前文件夹」，看不出在给谁授权。
  // 右键进来时调用方直接给名字；工具栏进来时用面包屑末级（当前目录）的名字兜底。
  let name = folderName
  if (!name) {
    const last = breadcrumbPath.value[breadcrumbPath.value.length - 1]
    if (last && String(last.folderId) === String(id)) {
      name = last.folderName
    }
  }
  if (!name) {
    // 面包屑还没加载好（例如刚进页面就点工具栏）：补一次再取
    try {
      const path = await getBreadcrumb(id)
      name = path?.[path.length - 1]?.folderName
    } catch { /* 取不到就退回 ID，至少不会显示错误的名字 */ }
  }
  permTarget.value = { type: 'folder', id, name: name || String(id) }
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
  // 这一项是否属于当前多选；属于就按整个选择来操作
  const menuItems = menuItemsOf(t as { type: string; data: any })
  // 没有授权能力的账号直接看不到这两项（而不是置灰），避免看到自己永远点不动的菜单项。
  // 有能力的账号也不代表处处能改：目标上没「完全控制」时点进去会给出明确提示
  const permissionItems = canConfigPermission.value
    ? [
        {
          label: '共享给...', icon: 'Share',
          onClick: () => isFolder
            ? openShare('folder', (t.data as Folder).folderId, (t.data as Folder).folderName)
            : openShare('file', file.fileId, file.fileName)
        },
        {
          label: '权限设置', icon: 'Lock',
          onClick: () => isFolder
            ? openFolderPermission((t.data as Folder).folderId, (t.data as Folder).folderName)
            : openFilePermission(t.data as DocFile)
        }
      ]
    : []
  return [
    { label: isFolder ? '打开' : '预览', icon: 'View', onClick: () => handleOpen(t.data as any) },
    {
      label: '下载',
      icon: 'Download',
      // 只读/无下载位的用户不显示可点状态：后端也会拦，但界面不该给出点了报错的入口
      onClick: () => downloadFile(t.data as any),
      disabled: !canDownloadItem(t.data)
    },
    {
      // 文件夹没有"单个文件"可下载，提供打包下载；多选时改为「下载所选」
      label: menuItems.length > 1
        ? `下载所选 (${menuItems.length} 项) zip`
        : '下载文件夹 (zip)',
      icon: 'FolderOpened',
      onClick: () => menuItems.length > 1 ? downloadSelectionZip() : downloadFolderZip(t.data as Folder),
      disabled: !canDownloadZip(t.data)
    },
    { label: '重命名', icon: 'Edit', onClick: () => renameItem(t) },
    { divider: true },
    {
      // 文件夹也支持：整棵子树递归复制；多选时作用于整个选择
      label: menuItems.length > 1 ? `复制所选 (${menuItems.length} 项)` : '复制',
      icon: 'Copy',
      onClick: () => {
        clipboard.copy(menuItems, currentFolderId.value)
        ElMessage.success(menuItems.length > 1
          ? `已复制 ${menuItems.length} 项`
          : `已复制「${isFolder ? (t.data as Folder).folderName : file.fileName}」`)
      }
    },
    {
      label: menuItems.length > 1 ? `剪切所选 (${menuItems.length} 项)` : '剪切',
      icon: 'Scissor',
      onClick: () => {
        clipboard.cut(menuItems, currentFolderId.value)
        ElMessage.success(menuItems.length > 1
          ? `已剪切 ${menuItems.length} 项`
          : `已剪切「${isFolder ? (t.data as Folder).folderName : file.fileName}」`)
      }
    },
    { label: '粘贴', icon: 'CopyDocument', onClick: () => doPaste(), disabled: clipboard.isEmpty },
    ...(permissionItems.length ? [{ divider: true }, ...permissionItems] : []),
    {
      label: menuItems.length > 1 ? `移动所选 (${menuItems.length} 项)...` : '移动到...',
      icon: 'FolderOpened',
      onClick: () => {
        // 关键：多选时搬整个选择，不是只搬鼠标右键的那一个
        moveItems.value = menuItems
        moveDialogVisible.value = true
      }
    },
    { divider: true },
    {
      label: menuItems.length > 1
        ? `删除所选 (${menuItems.length} 项)`
        : (isFolder ? '删除文件夹' : '删除'),
      icon: 'Delete',
      onClick: () => {
        if (menuItems.length > 1) {
          ElMessageBox.confirm(`确定删除选中的 ${menuItems.length} 项?`, '确认删除', { type: 'warning' })
            .then(() => deleteItems(menuItems)).catch(() => {})
        } else {
          deleteItem(t)
        }
      }
    },
    {
      label: '属性', icon: 'InfoFilled',
      onClick: () => openProperties(t.type, t.data)
    }
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
async function refreshTree() {
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

/** 能被图集浏览的扩展名（与后端 isImage 判断保持一致） */
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif']

function isImageFile(f: any): boolean {
  return IMAGE_EXTS.includes(String(f?.fileExtension || '').toLowerCase())
}

/**
 * 打开图片查看
 *
 * 一次把**当前目录里的图片**都带上，这样在图集里就能左右翻阅，
 * 不用退回列表再点下一张。目录里的非图片文件（PDF、Office、视频）不参与。
 */
async function openImageGallery(file: DocFile) {
  const siblings = (currentFiles.value || []).filter((f: any) => isImageFile(f))
  const list = siblings.length ? siblings : [file]
  const ids = list.map((f: any) => f.fileId)
  try {
    const media = await getFileMediaBatch(ids)
    // 后端会跳过没有预览权限的文件，这里按返回结果重建顺序
    const byId = new Map((media || []).map(m => [String(m.fileId), m]))
    const items: GalleryItem[] = []
    let startIndex = 0
    list.forEach((f: any, i: number) => {
      const m = byId.get(String(f.fileId))
      if (!m) return
      if (String(f.fileId) === String(file.fileId)) startIndex = items.length
      items.push({
        fileId: String(f.fileId),
        src: m.contentUrl,
        // 宽高拿不到时给个常见比例兜底，PhotoSwipe 载入后会用真实尺寸校正
        width: m.width || 1600,
        height: m.height || 1200,
        fileName: m.fileName || f.fileName,
        canDownload: canDownloadItem(f)
      })
      void i
    })
    if (!items.length) {
      ElMessage.warning('没有可查看的图片（可能需要预览权限）')
      return
    }
    galleryRef.value?.open(items, startIndex)
  } catch (e) {
    notifyError(e, '打开图片失败')
  }
}

/** 图集里点「下载原图」 */
function onGalleryDownload(item: GalleryItem) {
  downloadFileById(item.fileId, item.fileName)
}

/** 打开预览弹窗（图片之外的类型） */
function openPreview(file: DocFile) {
  if (isImageFile(file)) {
    openImageGallery(file)
    return
  }
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
  // 与 Windows 一致：右键落在"未选中"的条目上时，先把选择切成这一项；
  // 落在已选中的条目上则保留多选，这样「下载所选」的语义才明确
  const key = itemKeyOf(item)
  if (!selectedItems.value.some((s: any) => itemKeyOf(s) === key)) {
    selectedItems.value = [item]
  }
  contextMenu.visible = true
  contextMenu.position = { x: event.clientX, y: event.clientY }
  contextMenu.target = item
}

/**
 * 右键菜单里"批量操作"的作用对象
 *
 * 与 Windows 一致：右键落在**已选中**的条目上时，操作作用于整个选择；
 * 落在未选中的条目上时（handleContextMenu 已把选择切成这一项）只作用于它自己。
 *
 * 之前这里写死成 [t.data]，于是多选后右键「移动到…」只搬走了鼠标点的那一个，
 * 其余选中项纹丝不动 —— 而弹窗还写着"将 1 项移动到…"，点完才发现只走了一个。
 */
function menuItemsOf(t: { type: string; data: any }): any[] {
  const key = itemKeyOf(t)
  if (selectedItems.value.length > 1
      && selectedItems.value.some((s: any) => itemKeyOf(s) === key)) {
    return [...selectedItems.value]
  }
  return [t.data]
}

/** 批量删除：文件夹和文件分开调各自接口，逐个报错不中断其余项 */
async function deleteItems(items: any[]) {
  const folders = items.filter((x: any) =>
    (x.__type === 'folder') || (x.folderId != null && x.fileId == null))
  const files = items.filter((x: any) =>
    (x.__type === 'file') || (x.fileId != null && x.folderId == null))
  let ok = 0
  const failed: string[] = []
  for (const f of folders) {
    try { await deleteFolder(f.folderId); ok++ } catch (e: any) {
      failed.push(`${f.folderName || f.folderId}：${e?.msg || e?.message || '失败'}`)
    }
  }
  for (const f of files) {
    try { await deleteFile(f.fileId); ok++ } catch (e: any) {
      failed.push(`${f.fileName || f.fileId}：${e?.msg || e?.message || '失败'}`)
    }
  }
  if (ok) ElMessage.success(`已删除 ${ok} 项`)
  if (failed.length) ElMessage.error(`${failed.length} 项删除失败：${failed.slice(0, 3).join('；')}`)
  selectedItems.value = []
  loadCurrentFolder()
  refreshTree()
}

/**
 * 列表项唯一 key（文件夹用 folderId，文件用 fileId）
 *
 * 注意入参有两种形状：列表项是裸对象（带 __type），而右键事件传进来的是
 * `{ type, data }` 包装对象 —— 不兼容这两种形状，右键时就会判定"这一项不在选中集合里"，
 * 于是把多选重置成单项（表现为右键菜单永远显示单数文案）。
 */
function itemKeyOf(item: any): string {
  if (!item) return ''
  const raw = item.data ?? item
  const type = raw?.__type || item?.type
  if (type === 'folder') return `folder-${raw.folderId}`
  if (type === 'file') return `file-${raw.fileId}`
  // 兜底：按字段猜
  if (raw?.folderId !== undefined) return `folder-${raw.folderId}`
  if (raw?.fileId !== undefined) return `file-${raw.fileId}`
  return ''
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
        const items = [...selectedItems.value]
        ElMessageBox.confirm(`确定删除 ${items.length} 项?`, '确认', { type: 'warning' })
          .then(() => deleteItems(items)).catch(() => {})
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

/**
 * 下载文件夹（打包成 ZIP）
 *
 * 流程：预检 → 告知体量与"有多少因权限未包含" → 确认 → 流式下载。
 * 之所以要先预检：ZIP 响应是 chunked 的（无 Content-Length），
 * 拿不到百分比进度，只能在下发前把体量讲清楚。
 */
async function downloadFolderZip(folder: Folder) {
  try {
    const plan = await getFolderZipPlan(folder.folderId)
    const title = `下载文件夹「${folder.folderName}」`
    // 体量大（或超过同步上限）时改走后台打包：有真实进度，也不怕长连接被掐断
    if (plan.overLimit || plan.recommendAsync) {
      if (!(await confirmAsyncExport(plan, title))) return
      await submitFolderExport(folder.folderId)
      ElMessage.success('已提交后台打包，可在「导出任务」里查看进度并下载')
      return
    }
    if (!(await confirmZipPlan(plan, title))) return
    await downloadAsFile(`/api/doc/download/folders/${folder.folderId}`,
      `${folder.folderName}.zip`)
  } catch (e) {
    notifyError(e, '打包下载失败')
  }
}

/** 下载当前选中的多项（文件夹递归 + 文件平铺）打包 */
async function downloadSelectionZip() {
  const items = selectedItems.value
  if (!items.length) return
  const folderIds = items.filter((i: any) => i.__type === 'folder').map((i: any) => i.folderId)
  const fileIds = items.filter((i: any) => i.__type === 'file').map((i: any) => i.fileId)
  const title = `下载所选 ${items.length} 项`
  try {
    const plan = await getSelectionZipPlan(folderIds, fileIds)
    if (plan.overLimit || plan.recommendAsync) {
      if (!(await confirmAsyncExport(plan, title))) return
      await submitSelectionExport(folderIds, fileIds)
      ElMessage.success('已提交后台打包，可在「导出任务」里查看进度并下载')
      return
    }
    if (!(await confirmZipPlan(plan, title))) return
    await downloadAsFile('/api/doc/download/selection',
      `所选文件-${new Date().toISOString().slice(0, 10)}.zip`,
      { folderIds, fileIds })
  } catch (e) {
    notifyError(e, '打包下载失败')
  }
}

/** 体量大时改为后台打包的确认框 */
async function confirmAsyncExport(plan: any, title: string): Promise<boolean> {
  if (!plan?.fileCount) {
    ElMessage.warning('这里没有您可下载的文件（可能需要「下载」权限）')
    return false
  }
  const lines = [
    `共 ${plan.fileCount} 个文件，约 ${plan.totalSizeText}，体量较大。`,
    '将改为后台打包：提交后可以离开本页面，打包完成后在「导出任务」里下载（有进度显示）。',
    '压缩包默认保留 24 小时。'
  ]
  if (plan.skippedCount > 0) {
    lines.push(`注意：有 ${plan.skippedCount} 个文件因您没有下载权限，不会包含在内。`)
  }
  try {
    await ElMessageBox.confirm(lines.join('\n'), title, {
      confirmButtonText: '提交后台打包',
      cancelButtonText: '取消',
      type: 'info'
    })
    return true
  } catch {
    return false
  }
}

/**
 * 打包前的确认框
 *
 * 把「体量」和「有多少因权限被跳过」明确告知——否则用户拿到 ZIP 发现少了文件，
 * 会以为是系统丢数据。
 */
async function confirmZipPlan(plan: any, title: string): Promise<boolean> {
  if (plan?.overLimit) {
    ElMessage.error(plan.limitReason || '内容过多，请分批下载')
    return false
  }
  if (!plan?.fileCount) {
    ElMessage.warning('这里没有您可下载的文件（可能需要「下载」权限）')
    return false
  }
  const lines = [
    `共 ${plan.fileCount} 个文件，约 ${plan.totalSizeText}。`,
    '打包过程在服务端流式完成，文件较大时浏览器只显示"正在下载"、没有百分比。'
  ]
  if (plan.skippedCount > 0) {
    lines.push(`注意：有 ${plan.skippedCount} 个文件因您没有下载权限，不会包含在压缩包内。`)
  }
  try {
    await ElMessageBox.confirm(lines.join('\n'), title, {
      confirmButtonText: '开始下载',
      cancelButtonText: '取消',
      type: plan.skippedCount > 0 ? 'warning' : 'info',
      customClass: 'zip-confirm'
    })
    return true
  } catch {
    return false
  }
}

async function downloadFile(file: DocFile) {
  // 走统一封装：会识别「后端拒绝时其实是 JSON」的情况，不会下载到假文件
  await downloadFileById(file.fileId, file.fileName)
}

/**
 * 当前用户对某个条目是否可下载
 *
 * 文件夹暂不提供下载（见右键菜单的说明），因此这里只判文件。
 * userFlags 由后端在列表/详情里给出，缺失时按「不可下载」处理。
 */
function canDownloadItem(item: any): boolean {
  if (item?.__type === 'folder') return false
  return (Number(item?.userFlags ?? 0) & PermissionFlag.DOWNLOAD) !== 0
}

/**
 * 打包下载入口是否可点
 *
 * 文件夹看它在 userFlags 里有没有「下载」位（该位会向下继承给其中的文件）；
 * 多选时只要有任意一项带下载位就允许——真正的内容过滤由后端逐文件复核，
 * 界面这里只负责不给用户一个必然失败的入口。
 */
function canDownloadZip(item: any): boolean {
  const items = selectedItems.value.length > 1 ? selectedItems.value : [item?.data ?? item]
  return items.some((it: any) => (Number(it?.userFlags ?? 0) & PermissionFlag.DOWNLOAD) !== 0)
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
 * 粘贴到当前文件夹
 *
 * - 文件：复制 → 新记录引用同一 MinIO 对象；剪切 → 移动到当前目录
 * - 文件夹：复制 → 整棵子树递归复制；剪切 → 整体移动
 * - 同名处理：文件由后端自动重命名为「xxx (1).ext」；文件夹会先提示
 *   「合并内容 / 保留两者 / 取消」，其中「保留两者」也走自动重命名
 */
async function doPaste() {
  if (clipboard.isEmpty) {
    ElMessage.info('剪贴板为空')
    return
  }
  const targetId = currentFolderId.value
  if (targetId === 0) {
    ElMessage.warning('请先进入一个文件夹再粘贴（当前为文档根目录）')
    return
  }
  const entries = [...clipboard.entries]
  const isCut = clipboard.mode === 'cut'

  // 同名文件夹冲突：目标目录下已有同名子文件夹
  const targetNames = new Map(currentFolders.value.map(f => [f.folderName, f.folderId]))
  const conflicts = entries.filter(e => e.type === 'folder' && targetNames.has(e.name))

  let mergeNames = new Set<string>()
  if (conflicts.length) {
    const names = conflicts.map(c => `「${c.name}」`).join('、')
    const verb = isCut ? '移动' : '复制'
    try {
      await ElMessageBox.confirm(
        `目标位置已存在同名文件夹 ${names}。\n\n` +
        `· 合并内容：把源目录里的文件${verb}进已有文件夹（同名文件自动改名为「xxx (1).ext」，不覆盖）\n` +
        `· 保留两者：新建一个自动改名的文件夹，两边内容都保留`,
        '同名文件夹',
        {
          confirmButtonText: '合并内容',
          cancelButtonText: '保留两者',
          distinguishCancelAndClose: true,
          type: 'warning'
        }
      )
      mergeNames = new Set(conflicts.map(c => c.name))
    } catch (action) {
      if (action === 'close') return   // 点右上角 × → 放弃本次粘贴
      // action === 'cancel' → 保留两者（不改 mergeNames）
    }
  }

  let doneFiles = 0
  let doneFolders = 0
  const finished: number[] = []

  for (const entry of entries) {
    try {
      if (entry.type === 'file') {
        if (isCut) {
          await batchMoveFiles([entry.id], targetId)
        } else {
          await copyFile(entry.id, targetId)
        }
        doneFiles++
      } else {
        const destId = targetNames.get(entry.name)
        if (mergeNames.has(entry.name) && destId !== undefined) {
          if (isCut) {
            await mergeIntoFolder(entry.id, destId)
          } else {
            await copyFolder(entry.id, targetId, true)
          }
        } else {
          if (isCut) {
            await moveFolder(entry.id, targetId)
          } else {
            await copyFolder(entry.id, targetId, false)
          }
        }
        doneFolders++
      }
      finished.push(entry.id)
    } catch (e: any) {
      ElMessage.error(`「${entry.name}」粘贴失败：${e?.message || e?.msg || '未知错误'}`)
    }
  }

  const isCut2 = clipboard.mode === 'cut'
  if (isCut2) {
    // 剪切：成功的条目从剪贴板移除，失败的留着让用户重试
    clipboard.removeEntries(finished)
    if (finished.length === entries.length) clipboard.clear()
  }
  if (doneFiles || doneFolders) {
    const parts: string[] = []
    if (doneFolders) parts.push(`文件夹 ${doneFolders} 个`)
    if (doneFiles) parts.push(`文件 ${doneFiles} 个`)
    ElMessage.success(`已${isCut2 ? '移动' : '复制'}${parts.join('、')}`)
    selectedItems.value = []
    await Promise.all([loadCurrentFolder(), refreshTree()])
  }
}

/** 打开「共享给…」（快速授权） */
async function openShare(type: 'folder' | 'file', id: number, name: string) {
  if (!(await ensureFullControl(type, id))) return
  shareTarget.value = { type, id, name }
  shareVisible.value = true
}

/** 打开「属性」 */
function openProperties(type: 'file' | 'folder', data: DocFile | Folder) {
  propsType.value = type
  propsTarget.value = data
  propsVisible.value = true
}

/** 属性弹窗里的「位置」文本 */
const locationPathText = computed(() => {
  const names = breadcrumbPath.value.map(f => f.folderName)
  return ['全部文档', ...names].join(' / ')
})

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
  // Ctrl+C 复制 / Ctrl+X 剪切（支持文件夹与多选）
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x')) {
    if (!selectedItems.value.length) return
    e.preventDefault()
    const isCut = e.key.toLowerCase() === 'x'
    if (isCut) {
      clipboard.cut(selectedItems.value, currentFolderId.value)
    } else {
      clipboard.copy(selectedItems.value, currentFolderId.value)
    }
    ElMessage.success(`已${isCut ? '剪切' : '复制'} ${selectedItems.value.length} 项`)
    return
  }
  // Ctrl+V 粘贴
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    if (clipboard.isEmpty) return
    e.preventDefault()
    doPaste()
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
