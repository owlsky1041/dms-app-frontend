import { get, post, put, del } from './http'
import type { Folder, DocFile, PageResult } from '@/types/doc'

// ============ 文件夹 ============

// 说明：不提供个人根目录接口（无「我的文档」个人空间），顶层即 parentId=0

/** 列子文件夹 */
export function listChildren(parentId: number): Promise<Folder[]> {
  return get('/api/doc/folders/children', { parentId })
}

/**
 * 部门文档区 = 第一个顶层文档区（folder_id 最小者）
 *
 * 说明：导航栏文案固定为「部门文档」，与目录实际名称解耦（目录可被重命名，
 * 例如改名为「示例单位」）。这里按 folder_id 升序取创建最早的文档区，
 * 保证目录改名后入口依然指向同一位置。后端 listChildren 按 sort_order 排序，
 * 故显式按 id 排序。
 */
export async function getDeptArea(): Promise<Folder | null> {
  const roots = await listChildren(0)
  if (!roots || !roots.length) return null
  return [...roots].sort((a, b) => Number(a.folderId) - Number(b.folderId))[0]
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
  if (folderId == null) { return Promise.reject(new Error('缺少 folderId')); }
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

/** 复制文件到目标文件夹 */
export function copyFile(fileId: number, targetFolderId: number): Promise<number> {
  return post(`/api/doc/files/${fileId}/copy`, undefined, { params: { targetFolderId } })
}

/** 批量移动（剪切粘贴） */
export function batchMoveFiles(fileIds: number[], targetFolderId: number): Promise<void> {
  return put('/api/doc/files/batch-move', { fileIds, targetFolderId })
}

/** 软删除 */
export function deleteFile(fileId: number): Promise<void> {
  if (fileId == null) { return Promise.reject(new Error('缺少 fileId')); }
  return del(`/api/doc/files/${fileId}`)
}

/** 全局搜索 */
export function searchFiles(keyword: string, limit = 20): Promise<DocFile[]> {
  return get('/api/doc/files/search', { keyword, limit })
}

/**
 * 秒传检查（设计文档 POST /api/upload/check-hash）
 * 命中则 exists=true，前端可直接建引用而无需上传字节
 */
export function checkHash(hash: string): Promise<{ exists: boolean; fileId?: number; fileName?: string; fileSize?: number }> {
  return post('/api/upload/check-hash', { hash })
}

/** 秒传引用：在目标文件夹直接建立对已有存储对象的引用 */
export function instantUpload(
  hash: string,
  fileName: string,
  folderId: number | string
): Promise<{ fileId: number; fileName: string; instant: boolean }> {
  return post('/api/upload/instant', { hash, fileName, folderId: String(folderId) })
}

// ============ 回收站 ============

/** 回收站列表 */
export function listRecycle(): Promise<{ folders: Folder[]; files: DocFile[] }> {
  return get('/api/doc/recycle/list')
}

/** 恢复文件 */
export function restoreRecycleFile(fileId: number): Promise<void> {
  return post(`/api/doc/recycle/files/${fileId}/restore`)
}

/** 恢复文件夹 */
export function restoreRecycleFolder(folderId: number): Promise<void> {
  return post(`/api/doc/recycle/folders/${folderId}/restore`)
}

/** 永久删除文件 */
export function purgeRecycleFile(fileId: number): Promise<void> {
  return del(`/api/doc/recycle/files/${fileId}`)
}

/** 永久删除文件夹 */
export function purgeRecycleFolder(folderId: number): Promise<void> {
  return del(`/api/doc/recycle/folders/${folderId}`)
}

/** 清空回收站 */
export function emptyRecycle(): Promise<void> {
  return del('/api/doc/recycle/empty')
}

// ============ 权限 ============

/** 权限主体类型 */
export interface GrantReq {
  resourceType: 'folder' | 'file'
  resourceId: number
  subjectType: 'user' | 'role' | 'dept'
  subjectId: number
  permFlags: number
  inheritToChildren?: boolean
  expiresAt?: string | null
}

/** 查看文件夹授权 */
export function listFolderPerms(folderId: number): Promise<any[]> {
  return get(`/api/perm/folders/${folderId}`)
}

/** 查看文件授权 */
export function listFilePerms(fileId: number): Promise<any[]> {
  return get(`/api/perm/files/${fileId}`)
}

/** 授权（通用：文件夹走 folder 资源） */
export function grantFolder(folderId: number, req: Partial<GrantReq>): Promise<void> {
  return post(`/api/perm/folders/${folderId}/grant`, req)
}

/** 授权文件 */
export function grantFile(fileId: number, req: Partial<GrantReq>): Promise<void> {
  return post(`/api/perm/files/${fileId}/grant`, req)
}

/** 撤销文件夹授权 */
export function revokeFolder(folderId: number, subjectType: string, subjectId: number): Promise<void> {
  return del(`/api/perm/folders/${folderId}/revoke`, { params: { subjectType, subjectId } })
}

/** 撤销文件授权 */
export function revokeFile(fileId: number, subjectType: string, subjectId: number): Promise<void> {
  return del(`/api/perm/files/${fileId}/revoke`, { params: { subjectType, subjectId } })
}

/** 检查当前用户权限位 */
export function checkPerm(resourceType: 'folder' | 'file', resourceId: number): Promise<number> {
  return get('/api/perm/check', { resourceType, resourceId })
}

/** 查询可授权主体（用户/角色/部门，来自 RuoYi） */
export function listUsers(keyword?: string): Promise<any[]> {
  return get('/system/user/list', { pageNum: 1, pageSize: 50, userName: keyword || undefined })
}

export function listRoles(): Promise<any[]> {
  return get('/system/role/list', { pageNum: 1, pageSize: 50 })
}

export function listDepts(): Promise<any[]> {
  return get('/system/dept/list')
}
