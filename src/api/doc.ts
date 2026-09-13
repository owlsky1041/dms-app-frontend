import { get, post, put, del } from './http'
import { downloadAsFile } from '@/utils/download'
import type { Folder, DocFile, PageResult } from '@/types/doc'

// ============ 文件夹 ============

// 说明：不提供个人根目录接口（无「我的文档」个人空间），顶层即 parentId=0

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

/**
 * 复制文件夹（连同子文件夹与文件）
 *
 * @param targetParentId 目标父文件夹
 * @param merge          目标位置已有同名文件夹时是否合并内容（false=自动改名为 xxx (1)）
 * @returns 实际承载内容的文件夹 ID（合并时是已存在的那个）
 */
export function copyFolder(folderId: number, targetParentId: number, merge = false): Promise<number> {
  return post(`/api/doc/folders/${folderId}/copy`, { targetParentId, merge })
}

/** 把文件夹合并进目标位置已存在的同名文件夹（剪切粘贴时选「合并内容」） */
export function mergeIntoFolder(folderId: number, destFolderId: number): Promise<void> {
  return post(`/api/doc/folders/${folderId}/merge-into`, { destFolderId })
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
  /** 雪花 ID 必须用字符串传递：19 位超出 JS 安全整数范围 */
  subjectId: number | string
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

/**
 * 查看文件夹「实际生效」的权限：本层授权 + 继承自上级目录的授权
 *
 * 授权通常建在文档区或上级目录上，只列本层会让用户误以为没有任何权限。
 * 返回项含 sourceType：direct=本层（可撤销）/ inherited=继承（只读）。
 */
export function listFolderEffectivePerms(folderId: number): Promise<any[]> {
  return get(`/api/perm/folders/${folderId}/effective`)
}

/** 查看文件「实际生效」的权限：文件级授权 + 所在目录及其祖先链的授权 */
export function listFileEffectivePerms(fileId: number): Promise<any[]> {
  return get(`/api/perm/files/${fileId}/effective`)
}

// ==================== 打包下载（流式 ZIP） ====================

/** 打包预检结果 */
export interface ZipPlan {
  rootName: string
  fileCount: number
  totalBytes: number
  totalSizeText: string
  /** 因没有下载权限而被跳过的文件数 */
  skippedCount: number
  overLimit: boolean
  limitReason?: string | null
  /** 后端建议改用异步导出（体量大，同步流式没有进度条也容易被长连接掐断） */
  recommendAsync?: boolean
  asyncThresholdBytes?: number
  asyncThresholdFiles?: number
}

/**
 * 打包预检：下载前先问清体量与范围
 *
 * 因为 ZIP 响应是流式的（无 Content-Length），无法显示百分比进度，
 * 所以改成「开始前告诉用户共多少文件、多大、有多少无权限被跳过」。
 */
export function getFolderZipPlan(folderId: number | string): Promise<ZipPlan> {
  return get(`/api/doc/download/folders/${folderId}/plan`)
}

/** 多选内容的打包预检 */
export function getSelectionZipPlan(folderIds: Array<number | string>,
                                    fileIds: Array<number | string>): Promise<ZipPlan> {
  return post('/api/doc/download/selection/plan', { folderIds, fileIds })
}

// ==================== 异步打包导出任务 ====================

export interface ExportTask {
  taskId: string | number
  rootName: string
  /** PENDING / RUNNING / SUCCESS / FAILED / CANCELED / EXPIRED */
  status: string
  fileCount: number
  doneFiles: number
  totalBytes: number
  doneBytes: number
  zipBytes: number
  skippedCount: number
  errorMsg?: string
  createTime?: string
  finishTime?: string
  expireTime?: string
  downloadCount: number
  progress: number
}

/** 提交文件夹异步打包 */
export function submitFolderExport(folderId: number | string): Promise<ExportTask> {
  return post(`/api/doc/export/folders/${folderId}`)
}

/** 提交多选异步打包 */
export function submitSelectionExport(folderIds: Array<number | string>,
                                      fileIds: Array<number | string>): Promise<ExportTask> {
  return post('/api/doc/export/selection', { folderIds, fileIds })
}

/** 我的导出任务列表 */
export function listExportTasks(limit = 30): Promise<ExportTask[]> {
  return get('/api/doc/export/tasks', { limit })
}

/** 取消任务（仅未开始） */
export function cancelExportTask(taskId: number | string): Promise<void> {
  return post(`/api/doc/export/tasks/${taskId}/cancel`)
}

/** 删除任务（连带删除已生成的 ZIP） */
export function deleteExportTask(taskId: number | string): Promise<void> {
  return del(`/api/doc/export/tasks/${taskId}`)
}

/** 下载已完成的导出文件 */
export function downloadExportTask(taskId: number | string, fileName: string): Promise<boolean> {
  return downloadAsFile(`/api/doc/export/tasks/${taskId}/download`, fileName)
}

// ==================== 审计日志（仅超管） ====================

export interface AuditRow {
  logId: number
  userId: string | number
  action: string
  resourceType?: string
  resourceId?: string | number
  resourcePath?: string
  ip?: string
  userAgent?: string
  detail?: string
  createdAt?: string
}

/** 分页查询审计日志 */
export function listAuditLogs(params?: {
  action?: string
  userId?: string | number
  beginDay?: string
  endDay?: string
  pageNum?: number
  pageSize?: number
}): Promise<{ rows: AuditRow[]; total: number }> {
  return get('/api/doc/audit/list', { pageNum: 1, pageSize: 20, ...params })
}

/** 审计动作清单（避免前端硬编码） */
export function listAuditActions(): Promise<Array<{ code: string; label: string }>> {
  return get('/api/doc/audit/actions')
}

/** 审计筛选条件（列表 / 导出 / 计数 / 清除 共用同一套，保证"看到的就是导出的"） */
export interface AuditFilter {
  action?: string
  userId?: string | number
  beginDay?: string
  endDay?: string
}

/** 把筛选条件拼成查询串（导出走浏览器下载，没法用 axios 的 params） */
export function auditQueryString(f: AuditFilter = {}): string {
  const qs = new URLSearchParams()
  if (f.action) qs.set('action', f.action)
  if (f.userId !== undefined && f.userId !== null && f.userId !== '') qs.set('userId', String(f.userId))
  if (f.beginDay) qs.set('beginDay', f.beginDay)
  if (f.endDay) qs.set('endDay', f.endDay)
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/** 导出审计日志（CSV，服务端流式写出） */
export function exportAuditLogs(f: AuditFilter = {}): Promise<boolean> {
  return downloadAsFile(`/api/doc/audit/export${auditQueryString(f)}`)
}

/** 数一数当前条件下有多少条（清除前给用户看个数） */
export function countAuditLogs(f: AuditFilter = {}): Promise<number> {
  return get('/api/doc/audit/count', { ...f })
}

/** 清除审计日志：all=true 清空全部，否则按条件删 */
export function clearAuditLogs(f: AuditFilter & { all?: boolean } = {}): Promise<{ deleted: number; matchedBefore: number }> {
  // 用 POST：后端就是 POST（DELETE 带 body 会被部分中间层丢掉，不可逆操作不赌这个）
  return post('/api/doc/audit/clear', f)
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

/** 可授权主体（用户/角色/部门） */
export interface SubjectOption {
  id: string
  label: string
}

export interface Subjects {
  users: SubjectOption[]
  roles: SubjectOption[]
  depts: SubjectOption[]
}

/**
 * 查询可授权主体名单（用户 / 角色 / 部门）
 *
 * 走的是文档模块自己的接口，不是 RuoYi 的 /system/user/list：
 * 后者需要 system:user:list 等权限，等于"想让他授权就得连用户管理页面一起放开"。
 * 后端 /api/perm/subjects 只要授权能力即可读，并且只返回名字。
 *
 * ID 后端已转成字符串（雪花 ID 19 位超 JS 安全整数范围）。
 */
export function getSubjects(): Promise<Subjects> {
  return get('/api/perm/subjects').then((res: any) => {
    const mapUser = (u: any): SubjectOption => ({
      id: String(u.userId),
      label: `${u.nickName || u.userName}${u.userName ? `(${u.userName})` : ''}`
    })
    return {
      users: (res?.users || []).map(mapUser),
      roles: (res?.roles || []).map((r: any) => ({ id: String(r.roleId), label: r.roleName })),
      // 部门按名称排序：下拉里是平铺展示，原来的层级信息在这个组件里用不上
      depts: (res?.depts || []).map((d: any) => ({ id: String(d.deptId), label: d.deptName }))
    }
  })
}

/**
 * 换取图片/视频的短期直链
 *
 * <img src> / <video src> 这类原生请求带不上 Authorization 头，
 * 直接指向 /preview 会被判未登录（后端返回 200 + code 401，浏览器只当"加载失败"）。
 * 所以先向后端换一条带签名令牌的短期地址。
 */
export function getFileMedia(fileId: number | string): Promise<{
  contentUrl: string
  thumbnailUrl: string
  expiresIn: number
}> {
  return get(`/api/doc/files/${fileId}/media`)
}

/** 一张图的图集信息（PhotoSwipe 用：地址 + 原始宽高） */
export interface MediaItem {
  fileId: string
  fileName: string
  fileSize: number
  contentUrl: string
  thumbnailUrl: string
  width?: number
  height?: number
}

/**
 * 批量换取媒体直链（图片图集用）
 *
 * 一次拿回整个目录的图片地址与宽高：逐张调用会打出十几个请求。
 * 没有预览权限的文件后端会跳过，不会让整本图集打不开。
 */
export function getFileMediaBatch(fileIds: Array<number | string>): Promise<MediaItem[]> {
  return post('/api/doc/files/media-batch', { fileIds: fileIds.map(id => String(id)) })
}
