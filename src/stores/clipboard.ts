import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DocFile, Folder } from '@/types/doc'

/**
 * 剪贴板条目：文件与文件夹统一表示
 *
 * 只存定位所需的少量字段，避免复制后源被改名/移动导致展示与实际不一致。
 */
export interface ClipEntry {
  type: 'file' | 'folder'
  id: number
  name: string
  /** 来源所在文件夹，用于判断「原地粘贴」 */
  sourceFolderId: number
}

/**
 * 剪贴板 store（Windows 风格 复制/剪切/粘贴）
 *
 * 支持文件夹：文件夹的复制是整棵子树递归复制，剪切是整体移动。
 */
export const useClipboardStore = defineStore('clipboard', () => {
  /** 'cut' = 剪切（粘贴后源消失）; 'copy' = 复制 */
  const mode = ref<'cut' | 'copy'>('copy')
  const entries = ref<ClipEntry[]>([])
  /** 仅文件（给旧调用方/展示用） */
  const files = computed(() =>
    entries.value.filter((e) => e.type === 'file').map((e) => ({ fileId: e.id, fileName: e.name }))
  )
  const folders = computed(() =>
    entries.value.filter((e) => e.type === 'folder').map((e) => ({ folderId: e.id, folderName: e.name }))
  )
  const count = computed(() => entries.value.length)
  const isEmpty = computed(() => entries.value.length === 0)

  function toEntry(item: any): ClipEntry {
    // 列表项带 __type 标记；也兼容直接传 DocFile / Folder
    const type: 'file' | 'folder' =
      item.__type || (item.fileId !== undefined ? 'file' : 'folder')
    // 注意：文件的所属目录是 folderId，而文件夹的所属目录是 parentId
    // （folder.folderId 是它自己的 id），两者不能混用
    const sourceFolderId = type === 'file'
      ? Number(item.folderId ?? 0)
      : Number(item.parentId ?? 0)
    return {
      type,
      id: Number(type === 'file' ? item.fileId : item.folderId),
      name: type === 'file' ? item.fileName : item.folderName,
      sourceFolderId
    }
  }

  function copy(items: any[], fromFolderId?: number) {
    entries.value = items.map((it) => {
      const e = toEntry(it)
      return { ...e, sourceFolderId: fromFolderId ?? e.sourceFolderId }
    })
    mode.value = 'copy'
  }

  function cut(items: any[], fromFolderId?: number) {
    entries.value = items.map((it) => {
      const e = toEntry(it)
      return { ...e, sourceFolderId: fromFolderId ?? e.sourceFolderId }
    })
    mode.value = 'cut'
  }

  /** 粘贴完成后从剪贴板移除指定条目（部分成功时只清除成功的） */
  function removeEntries(ids: Array<number | string>) {
    const set = new Set(ids.map(String))
    entries.value = entries.value.filter((e) => !set.has(String(e.id)))
  }

  function clear() {
    entries.value = []
    mode.value = 'copy'
  }

  return { mode, entries, files, folders, count, isEmpty, copy, cut, removeEntries, clear }
})
