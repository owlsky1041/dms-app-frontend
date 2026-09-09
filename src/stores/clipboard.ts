import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DocFile } from '@/types/doc'

/**
 * 剪贴板 store（Windows 风格 复制/剪切/粘贴）
 */
export const useClipboardStore = defineStore('clipboard', () => {
  /** 'cut' = 剪切（粘贴后删除源）; 'copy' = 复制 */
  const mode = ref<'cut' | 'copy'>('copy')
  const files = ref<DocFile[]>([])
  const sourceFolderId = ref<number | null>(null)

  const isEmpty = () => files.value.length === 0

  function copy(filesToCopy: DocFile[], fromFolderId?: number) {
    files.value = [...filesToCopy]
    mode.value = 'copy'
    sourceFolderId.value = fromFolderId ?? null
  }

  function cut(filesToCut: DocFile[], fromFolderId?: number) {
    files.value = [...filesToCut]
    mode.value = 'cut'
    sourceFolderId.value = fromFolderId ?? null
  }

  function clear() {
    files.value = []
    mode.value = 'copy'
    sourceFolderId.value = null
  }

  return { mode, files, sourceFolderId, isEmpty, copy, cut, clear }
})
