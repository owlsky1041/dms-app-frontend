/**
 * DMS 文档管理类型定义
 */

/** 文件夹 */
export interface Folder {
  folderId: number
  parentId: number
  folderPath: string
  folderName: string
  icon?: string
  description?: string
  sortOrder?: number
  ownerId: number
  deptId?: number
  createTime?: string
  updateTime?: string
}

/** 文件 */
export interface DocFile {
  fileId: number
  folderId: number
  fileName: string
  fileExtension?: string
  fileSize: number
  fileHash: string
  mimeType?: string
  pageCount?: number
  width?: number
  height?: number
  durationMs?: number
  creatorId: number
  description?: string
  createTime?: string
  updateTime?: string
  // 视图层附加
  previewUrl?: string
  thumbnailUrl?: string
  downloadUrl?: string
  userFlags?: number
}

/** 分页响应 */
export interface PageResult<T> {
  records: T[]
  total: number
  size: number
  current: number
  pages: number
}

/** 权限位 */
export enum PermissionFlag {
  VISIBLE = 1,
  PREVIEW = 2,
  DOWNLOAD = 8,
  DELETE = 16,
  /** 上传：含在被授权目录下新建子文件夹 */
  UPLOAD = 32,
  /** 完全控制：修改权限、重命名、移动 */
  FULL_CONTROL = 128,
  /** 禁止访问（拒绝位，命中即完全不可见，向下继承） */
  DENY = 256
}

/** 全部授予位（不含禁止位） */
export const PERMISSION_FULL = 187

/** 权限主体类型 */
export type SubjectType = 'user' | 'role' | 'dept'

/** 文件权限条目 */
export interface FilePermission {
  permId?: number
  fileId?: number
  folderId?: number
  subjectType: SubjectType
  subjectId: number
  subjectName?: string
  permFlags: number
  inheritToChildren?: boolean
  expiresAt?: string
  grantedBy: number
  grantedAt?: string
}

/** 文件类型枚举 */
export type FileCategory =
  | 'pdf' | 'image' | 'video' | 'audio'
  | 'text' | 'code' | 'office' | 'cad'
  | 'archive' | '3d' | 'unknown'

/** 通过 MIME 判断文件分类 */
export function getCategory(mime?: string, ext?: string): FileCategory {
  if (!mime && !ext) return 'unknown'
  if (mime?.startsWith('image/')) {
    if (mime === 'image/svg+xml' || mime === 'image/heic' || mime === 'image/heif') return 'image'
    return 'image'
  }
  if (mime?.startsWith('video/')) return 'video'
  if (mime?.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf') return 'pdf'
  if (mime?.includes('officedocument') || mime?.includes('msword') || mime?.includes('ms-excel') || mime?.includes('ms-powerpoint')) {
    return 'office'
  }
  if (mime?.startsWith('text/') || mime?.includes('json') || mime?.includes('xml') || mime?.includes('javascript')) {
    return mime.includes('code') || ['json', 'xml'].includes(mime.split('/')[1]) ? 'code' : 'text'
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext?.toLowerCase() || '')) return 'archive'
  if (['glb', 'gltf', 'obj', 'stl', 'fbx'].includes(ext?.toLowerCase() || '')) return '3d'
  if (ext?.toLowerCase() === 'dxf' || ext?.toLowerCase() === 'dwg') return 'cad'
  return 'unknown'
}
