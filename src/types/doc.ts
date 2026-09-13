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

/**
 * 单个权限位（位掩码）
 *
 * 对用户暴露的是 4 个档位 + 1 个可叠加开关，这些位是底层的实现细节：
 *   只读 = 可见+预览(3) / 读写 = 只读+编辑+删除+上传(55) / 完全控制 = 读写+下载+授权(191)
 *   下载 = 独立叠加位(8) / 禁止访问 = 拒绝位(256)
 */
export enum PermissionFlag {
  VISIBLE = 1,
  PREVIEW = 2,
  /** 编辑：改名、移动（「读写」档含此位） */
  EDIT = 4,
  DOWNLOAD = 8,
  DELETE = 16,
  UPLOAD = 32,
  FULL_CONTROL = 128,
  /** 禁止访问（拒绝位，与所有授予互斥，向下继承） */
  DENY = 256
}

/** 档位掩码（嵌套：只读 ⊂ 读写 ⊂ 完全控制） */
export const PERM_READ_ONLY = 3
export const PERM_READ_WRITE = 55
export const PERM_FULL = 191
/** 完全控制（别名，语义上是「全部授予位」） */
export const PERMISSION_FULL = PERM_FULL
/** 禁止访问 */
export const PERM_DENY = 256

/** 档位定义（界面按这个顺序渲染单选项） */
export interface PermLevelDef {
  key: string
  label: string
  /** 给管理员看的一句话说明 */
  desc: string
  flags: number
}

export const PERM_LEVELS: PermLevelDef[] = [
  {
    key: 'readonly',
    label: '只读',
    desc: '能看见、能在线预览；原件带不走',
    flags: PERM_READ_ONLY
  },
  {
    key: 'readwrite',
    label: '读写',
    desc: '在只读基础上，可上传、改名、移动、删除（不能给别人授权）',
    flags: PERM_READ_WRITE
  },
  {
    key: 'full',
    label: '完全控制',
    desc: '文件操作全开，并且可以把权限分配给其他用户/角色/部门',
    flags: PERM_FULL
  },
  {
    key: 'deny',
    label: '禁止访问',
    desc: '完全看不到（列表与搜索都不出现），且对其下所有子项生效；优先级高于任何授权',
    flags: PERM_DENY
  }
]

/** 「下载」是可叠加在只读/读写之上的独立开关 */
export const PERM_DOWNLOAD = PermissionFlag.DOWNLOAD

/**
 * 由位掩码反推档位 key
 *
 * 历史数据里可能存在只给了「可见」、或只有「完全控制」没有「编辑」的授权，
 * 这里按「包含关系」宽容判断，取能解释该掩码的最高档位。
 */
export function permLevelOf(flags: number): string {
  const f = Number(flags) || 0
  if (f & PERM_DENY) return 'deny'
  if ((f & PERM_FULL) === PERM_FULL) return 'full'
  if (f & PermissionFlag.FULL_CONTROL) return 'full'
  if (f & (PermissionFlag.EDIT | PermissionFlag.DELETE | PermissionFlag.UPLOAD)) return 'readwrite'
  return 'readonly'
}

/** 是否勾选「下载」开关 */
export function permHasDownload(flags: number): boolean {
  return (Number(flags) & PermissionFlag.DOWNLOAD) !== 0
}

/** 掩码 → 界面标签数组（用于权限清单表格与标签展示） */
export function describePerm(flags: number): string[] {
  const f = Number(flags) || 0
  if (f & PERM_DENY) return ['禁止访问']
  const level = permLevelOf(f)
  const def = PERM_LEVELS.find(l => l.key === level)
  const out = [def?.label || '只读']
  if (level !== 'full' && permHasDownload(f)) out.push('下载')
  return out
}

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
