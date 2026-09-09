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

export function resetUserPwd(userId: number, password: string): Promise<void> {
  return put(`/system/user/${userId}/resetPwd`, undefined, { params: { password } })
}

/** 修改用户状态 */
export function changeUserStatus(userId: number, status: string): Promise<void> {
  return put(`/system/user/${userId}/changeStatus`, undefined, { params: { status } })
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
