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

  const isLoggedIn = computed(() => !!token.value)

  function setUser(info: {
    token: string
    userId: string
    username: string
    nickname?: string
    avatar?: string
    roleIds?: number[]
    deptIds?: number[]
  }) {
    token.value = info.token
    userId.value = info.userId
    username.value = info.username
    nickname.value = info.nickname || info.username
    avatar.value = info.avatar || ''
    roleIds.value = info.roleIds || []
    deptIds.value = info.deptIds || []
    saveToStorage()
  }

  function logout() {
    token.value = ''
    userId.value = ''
    username.value = ''
    nickname.value = ''
    avatar.value = ''
    roleIds.value = []
    deptIds.value = []
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
      deptIds: deptIds.value
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
    isLoggedIn,
    setUser,
    logout,
    restoreFromStorage,
    saveToStorage
  }
})
