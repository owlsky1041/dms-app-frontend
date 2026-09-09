import { get, post, put, del } from './http'
import type { Folder, DocFile, PageResult } from '@/types/doc'

// ============ 文件夹 ============

/** 获取当前用户的根文件夹 */
export function getRootFolder(): Promise<Folder> {
  return get('/api/doc/folders/root')
}

/** 列子文件夹 */
export function listChildren(parentId: number): Promise<Folder[]> {
  return get('/api/doc/folders/children', { parentId })
}

/** 创建文件夹 */
export function createFolder(parentId: number, name: string, description?: string): Promise<Folder> {
  return post('/api/doc/folders', { parentId, name, description })
}

/** 重命名 */
export function renameFolder(folderId: number, name: string): Promise<void> {
  return put(`/api/doc/folders/${folderId}/rename`, undefined, { params: { name } })
}

/** 移动 */
export function moveFolder(folderId: number, newParentId: number): Promise<void> {
  return put(`/api/doc/folders/${folderId}/move`, { newParentId })
}

/** 软删除（到回收站） */
export function deleteFolder(folderId: number): Promise<void> {
  return del(`/api/doc/folders/${folderId}`)
}

/** 面包屑 */
export function getBreadcrumb(folderId: number): Promise<Folder[]> {
  return get(`/api/doc/folders/${folderId}/breadcrumb`)
}

// ============ 文件 ============

/** 列文件 */
export function listFiles(folderId: number, page = 1, size = 20): Promise<PageResult<DocFile>> {
  return get('/api/doc/files', { folderId, page, size })
}

/** 文件详情 */
export function getFileDetail(fileId: number): Promise<DocFile> {
  return get(`/api/doc/files/${fileId}`)
}

/** 重命名 */
export function renameFile(fileId: number, name: string): Promise<void> {
  return put(`/api/doc/files/${fileId}/rename`, undefined, { params: { name } })
}

/** 移动 */
export function moveFile(fileId: number, targetFolderId: number): Promise<void> {
  return put(`/api/doc/files/${fileId}/move`, undefined, { params: { targetFolderId } })
}

/** 软删除 */
export function deleteFile(fileId: number): Promise<void> {
  return del(`/api/doc/files/${fileId}`)
}

/** 全局搜索 */
export function searchFiles(keyword: string, limit = 20): Promise<DocFile[]> {
  return get('/api/doc/files/search', { keyword, limit })
}

/** 秒传检查 */
export function checkHash(hash: string): Promise<{ exists: boolean; fileId?: number }> {
  return post('/api/upload/check-hash', { hash })
}
