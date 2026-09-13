import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 用户登录态 store
 */
export const useUserStore = defineStore('user', () => {
  const token = ref<string>('')
  const userId = ref<string>('')
  const username = ref<string>('')
  const nickname = ref<string>('')
  const avatar = ref<string>('')
  const roleIds = ref<number[]>([])
  const deptIds = ref<number[]>([])
  /** 角色标识集合，如 ['superadmin'] */
  const roles = ref<string[]>([])
  /** 菜单权限串集合，超管为 ['*:*:*'] */
  const permissions = ref<string[]>([])

  const isLoggedIn = computed(() => !!token.value)

  /**
   * 是否超级管理员（决定「系统管理」菜单与权限配置入口是否可见）
   *
   * 依据是后端下发的通配权限串 `*:*:*`，而不是角色标识：
   * 后端 {@code LoginHelper.isSuperAdmin()} 判定的是「用户 ID 等于配置的超管 ID」，
   * 并在超管时把菜单权限直接置为 `*:*:*`（SysPermissionServiceImpl.getMenuPermission）。
   * 所以 `*:*:*` 与后端超管判定完全等价；若改用 roleKey='superadmin'，
   * 一旦有人把该角色授予其他用户，前端会显示权限配置入口而后端一律拒绝。
   */
  const isSuperAdmin = computed(() => permissions.value.includes('*:*:*'))

  /**
   * 是否具备某个菜单/操作权限
   *
   * 超管的 permissions 为 ['*:*:*']，一律放行。
   */
  function hasPermission(perm?: string | string[]): boolean {
    if (!perm) return true
    if (permissions.value.includes('*:*:*')) return true
    const list = Array.isArray(perm) ? perm : [perm]
    return list.some(p => permissions.value.includes(p))
  }

  function setUser(info: {
    token: string
    userId: string
    username: string
    nickname?: string
    avatar?: string
    roleIds?: number[]
    deptIds?: number[]
    roles?: string[]
    permissions?: string[]
  }) {
    token.value = info.token
    userId.value = info.userId
    username.value = info.username
    nickname.value = info.nickname || info.username
    avatar.value = info.avatar || ''
    roleIds.value = info.roleIds || []
    deptIds.value = info.deptIds || []
    roles.value = info.roles || []
    permissions.value = info.permissions || []
    saveToStorage()
  }

  /**
   * 用后端返回的用户信息覆盖本地角色与权限
   *
   * localStorage 只用于「刷新页面后先把界面显示出来」，**不能作为权限依据**：
   *  - 旧版本存下的记录里根本没有 roles/permissions 字段
   *  - 管理员在后台改了角色，本地也不会知道
   * 两者都会让超级管理员被判成普通用户（系统管理菜单整个消失、右键没有权限设置）。
   * 所以每次应用启动都要回后端拉一次，由 main.ts 调用本方法写入。
   *
   * 这里只写状态、不发请求，避免 stores/user 与 api/http 互相 import 成环。
   */
  function applyProfile(info: {
    user?: { userId?: string | number; userName?: string; nickName?: string }
    roles?: string[]
    permissions?: string[]
  }): void {
    const u: any = info?.user || {}
    if (u.userId) userId.value = String(u.userId)
    if (u.userName) username.value = u.userName
    if (u.nickName) nickname.value = u.nickName
    roles.value = info?.roles || []
    permissions.value = info?.permissions || []
    saveToStorage()
    console.info('[DMS] 当前用户角色:', roles.value, '权限:', permissions.value)
  }

  function logout() {
    token.value = ''
    userId.value = ''
    username.value = ''
    nickname.value = ''
    avatar.value = ''
    roleIds.value = []
    deptIds.value = []
    roles.value = []
    permissions.value = []
    localStorage.removeItem('dms-user')
  }

  function saveToStorage() {
    localStorage.setItem('dms-user', JSON.stringify({
      token: token.value,
      userId: userId.value,
      username: username.value,
      nickname: nickname.value,
      avatar: avatar.value,
      roleIds: roleIds.value,
      deptIds: deptIds.value,
      roles: roles.value,
      permissions: permissions.value
    }))
  }

  function restoreFromStorage() {
    const raw = localStorage.getItem('dms-user')
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      token.value = data.token || ''
      userId.value = String(data.userId || '')
      username.value = data.username || ''
      nickname.value = data.nickname || ''
      avatar.value = data.avatar || ''
      roleIds.value = data.roleIds || []
      deptIds.value = data.deptIds || []
      roles.value = data.roles || []
      permissions.value = data.permissions || []
    } catch (e) {
      console.warn('Failed to restore user from storage', e)
    }
  }

  // store 实例化时立即恢复登录态（避免路由守卫先于页面 onMounted 判断）
  restoreFromStorage()

  return {
    token,
    userId,
    username,
    nickname,
    avatar,
    roleIds,
    deptIds,
    roles,
    permissions,
    isLoggedIn,
    isSuperAdmin,
    hasPermission,
    applyProfile,
    setUser,
    logout,
    restoreFromStorage,
    saveToStorage
  }
})
