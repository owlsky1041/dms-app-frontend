import { get, post, put, del } from './http'

// ============ 用户管理 ============

/** 用户列表 */
export function listSysUsers(params?: any): Promise<{ rows: any[]; total: number }> {
  return get('/system/user/list', { pageNum: 1, pageSize: 20, ...params })
}

export function createSysUser(data: any): Promise<void> {
  return post('/system/user', data)
}

export function updateSysUser(data: any): Promise<void> {
  return put('/system/user', data)
}

export function deleteSysUser(userIds: number[] | string): Promise<void> {
  return del(`/system/user/${userIds}`)
}

/**
 * 重置密码（RuoYi 6.0：PUT /system/user/resetPwd，body 传 userId+password）
 */
export function resetUserPwd(userId: number | string, password: string): Promise<void> {
  return put('/system/user/resetPwd', { userId, password })
}

/**
 * 修改用户状态（RuoYi 6.0：PUT /system/user/changeStatus，body 传 userId+status）
 */
export function changeUserStatus(userId: number | string, status: string): Promise<void> {
  return put('/system/user/changeStatus', { userId, status })
}

/**
 * 查询用户已分配角色（回显用）
 * 注意：authRole 返回的 roles 是「可分配角色目录」，用 flag 标记是否已分配，
 * 且 roleIds 恒为 null —— 不能当作已分配角色使用。
 * 已分配角色请用 getSysUser(userId).roleIds。
 */
export function getUserAuthRole(userId: number | string): Promise<any> {
  return get(`/system/user/authRole/${userId}`)
}

/**
 * 查询单个用户详情（权威来源）
 * 返回 { user, roleIds, roles, postIds, posts }，其中 roleIds 为已分配角色ID，与数据库一致
 */
export function getSysUser(userId: number | string): Promise<any> {
  return get(`/system/user/${userId}`)
}

/**
 * 保存用户角色关联
 */
export function saveUserAuthRole(userId: number | string, roleIds: Array<number | string>): Promise<void> {
  return put('/system/user/authRole', undefined, {
    params: { userId, roleIds: roleIds.join(',') }
  })
}

// ============ 个人中心（当前登录用户自助） ============

/** 个人资料（含角色） */
export function getProfile(): Promise<any> {
  return get('/system/user/profile')
}

/** 修改个人资料（真实姓名/手机/邮箱/性别） */
export function updateProfile(data: any): Promise<void> {
  return put('/system/user/profile', data)
}

/** 修改本人密码 */
export function updateOwnPwd(oldPassword: string, newPassword: string): Promise<void> {
  return put('/system/user/profile/updatePwd', { oldPassword, newPassword })
}

// ============ 角色管理 ============

export function listSysRoles(params?: any): Promise<{ rows: any[]; total: number }> {
  return get('/system/role/list', { pageNum: 1, pageSize: 50, ...params })
}

/**
 * 新增角色
 * 注意：RuoYi 6.0 的 insertRole 会直接读取 menuIds/deptIds 的 length，
 * 传 null 会抛 NullPointerException，因此必须显式传空数组。
 */
export function createSysRole(data: any): Promise<void> {
  return post('/system/role', { menuIds: [], deptIds: [], ...data })
}

export function updateSysRole(data: any): Promise<void> {
  return put('/system/role', data)
}

export function deleteSysRole(roleIds: number[] | string): Promise<void> {
  return del(`/system/role/${roleIds}`)
}

/** 角色已选菜单 + 全量菜单树（分配权限回显用） */
export function getRoleMenuTree(roleId: number | string): Promise<{ menus: any[]; checkedKeys: any[] }> {
  return get(`/system/menu/roleMenuTreeselect/${roleId}`)
}

/** 角色数据权限部门树（保留原有部门范围用） */
export function getRoleDeptTree(roleId: number | string): Promise<{ depts: any[]; checkedKeys: any[] }> {
  return get(`/system/role/deptTree/${roleId}`)
}

/**
 * 保存角色权限
 * 注意：editPermission 同时处理菜单与数据权限部门，两者都必须传数组（否则 NPE）
 */
export function saveRolePermission(
  roleId: number | string,
  menuIds: Array<number | string>,
  deptIds: Array<number | string> = []
): Promise<void> {
  return put('/system/role/permission', { roleId, menuIds, deptIds })
}

// ============ 部门管理 ============

/** 部门树 */
export function listSysDepts(params?: any): Promise<any[]> {
  return get('/system/dept/list', params)
}

export function createSysDept(data: any): Promise<void> {
  return post('/system/dept', data)
}

export function updateSysDept(data: any): Promise<void> {
  return put('/system/dept', data)
}

export function deleteSysDept(deptId: number): Promise<void> {
  return del(`/system/dept/${deptId}`)
}

// ============ 系统参数 ============

export function listSysConfigs(params?: any): Promise<{ rows: any[]; total: number }> {
  return get('/system/config/list', { pageNum: 1, pageSize: 20, ...params })
}

export function updateSysConfig(data: any): Promise<void> {
  return put('/system/config', data)
}

// ============ 系统信息（服务器/数据库/MinIO/Redis 监控） ============

export interface SystemInfo {
  collectedAt: string
  server: {
    hostName?: string; osName?: string; osVersion?: string; osArch?: string
    /** 发行版全名，如 Debian GNU/Linux 13 (trixie)；非 Linux 为 null */
    osPrettyName?: string | null
    /** 内核版本（Linux 上就是 os.version） */
    kernelVersion?: string; cpuArch?: string
    cpuCores?: number; cpuModel?: string | null
    loadAverage?: number | null
    load1?: number | null; load5?: number | null; load15?: number | null
    /** 1 分钟负载 ÷ 核数：>1 说明排队了 */
    loadPerCore?: number | null
    memTotalBytes?: number; memFreeBytes?: number; memUsedBytes?: number; memUsedPercent?: number
    swapTotalBytes?: number; swapFreeBytes?: number; swapUsedBytes?: number
    hostUptimeText?: string | null
  }
  jvm: {
    javaVersion?: string; javaVendor?: string; jvmName?: string; javaVmVersion?: string
    javaHome?: string; pid?: number
    startTime?: string; uptimeMs?: number; uptimeText?: string
    heapInitBytes?: number; heapUsedBytes?: number; heapMaxBytes?: number
    heapCommittedBytes?: number; heapUsedPercent?: number
    nonHeapUsedBytes?: number; nonHeapCommittedBytes?: number
    metaspaceUsedBytes?: number; metaspaceMaxBytes?: number
    threadCount?: number; peakThreadCount?: number; daemonThreadCount?: number
    loadedClassCount?: number; totalLoadedClassCount?: number; unloadedClassCount?: number
    gc?: Array<{ name: string; count: number; timeMs: number }>
    gcCount?: number; gcTimeMs?: number
    jvmArgs?: string[]
    timezone?: string; locale?: string; fileEncoding?: string; workingDir?: string
    exportDir?: string; tusTempDir?: string
  }
  disks: Array<{
    path: string; store?: string; exists?: boolean
    totalBytes?: number; usableBytes?: number; usedBytes?: number; usedPercent?: number
    error?: string
  }>
  /** DMS 自己目录的占用（对象存储数据、导出目录、上传临时目录、日志） */
  dmsDirs: Array<{ path: string; bytes: number }>
  database: Record<string, any>
  /** MinIO：config 是用到的配置，其余是运行状态 */
  minio: Record<string, any> & { config?: Record<string, any> }
  redis: Record<string, any>
  business: Record<string, any>
}

/** 采集一份系统快照（仅超管） */
export function getSystemInfo(): Promise<SystemInfo> {
  return get('/api/doc/system/info')
}
