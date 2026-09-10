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
 * 返回 { user, roles, roleIds }
 */
export function getUserAuthRole(userId: number | string): Promise<any> {
  return get(`/system/user/authRole/${userId}`)
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

export function createSysRole(data: any): Promise<void> {
  return post('/system/role', data)
}

export function updateSysRole(data: any): Promise<void> {
  return put('/system/role', data)
}

export function deleteSysRole(roleIds: number[] | string): Promise<void> {
  return del(`/system/role/${roleIds}`)
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
