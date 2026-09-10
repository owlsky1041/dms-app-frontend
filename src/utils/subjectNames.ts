import { ref, type Ref } from 'vue'
import { post } from '@/api/http'

/**
 * 主体名称解析（ID → 真实姓名/名称）
 *
 * 界面按「真实姓名」展示创建者、所有者、权限主体，底层仍以 ID 关联。
 * 这里做一次性批量解析 + 会话内缓存：
 *  - 组件只需声明「我要显示这些 ID」，不必自己发请求
 *  - 30ms 内的多次声明会合并成一次请求（列表渲染时不会打出 N 个请求）
 *  - 解析不到时由调用方退回显示 ID，界面不会空白
 */

type SubjectType = 'user' | 'role' | 'dept'

const caches: Record<SubjectType, Ref<Record<string, string>>> = {
  user: ref({}),
  role: ref({}),
  dept: ref({})
}

const pending: Record<SubjectType, Set<string>> = {
  user: new Set(),
  role: new Set(),
  dept: new Set()
}

let timer: ReturnType<typeof setTimeout> | null = null

/** 声明「需要这些 ID 的名称」，必要时触发批量解析 */
export function ensureNames(type: SubjectType, ids: Array<string | number | null | undefined>): void {
  const cache = caches[type].value
  for (const raw of ids) {
    if (raw === null || raw === undefined || raw === '') continue
    const key = String(raw)
    if (key === '0' || cache[key] || pending[type].has(key)) continue
    pending[type].add(key)
  }
  if (timer) return
  timer = setTimeout(flush, 30)
}

async function flush(): Promise<void> {
  timer = null
  const body = {
    userIds: [...pending.user],
    roleIds: [...pending.role],
    deptIds: [...pending.dept]
  }
  pending.user.clear()
  pending.role.clear()
  pending.dept.clear()
  if (!body.userIds.length && !body.roleIds.length && !body.deptIds.length) return

  try {
    const data: any = await post('/api/doc/subjects/names', body)
    caches.user.value = { ...caches.user.value, ...(data?.users || {}) }
    caches.role.value = { ...caches.role.value, ...(data?.roles || {}) }
    caches.dept.value = { ...caches.dept.value, ...(data?.depts || {}) }
  } catch (e) {
    // 解析失败不阻塞界面：调用方会退回显示 ID
    console.warn('[subjectNames] 名称解析失败', e)
  }
}

/** 用户真实姓名（sys_user.nick_name） */
export function userName(id?: string | number | null): string {
  if (id === null || id === undefined || id === '') return ''
  return caches.user.value[String(id)] || ''
}

export function roleName(id?: string | number | null): string {
  if (id === null || id === undefined || id === '') return ''
  return caches.role.value[String(id)] || ''
}

export function deptName(id?: string | number | null): string {
  if (id === null || id === undefined || id === '') return ''
  return caches.dept.value[String(id)] || ''
}

/** 展示用：优先真实姓名，取不到则退回「类型#ID」，避免界面空白 */
export function displayUserName(id?: string | number | null): string {
  if (id === null || id === undefined || id === '') return '—'
  return userName(id) || String(id)
}

const typeLabel: Record<SubjectType, string> = { user: '用户', role: '角色', dept: '部门' }

/** 权限主体展示：用户显示真实姓名，角色/部门显示各自名称 */
export function displaySubject(type: string, id?: string | number | null): string {
  if (id === null || id === undefined || id === '') return '—'
  const t = (type || '') as SubjectType
  const name = t === 'user' ? userName(id) : t === 'role' ? roleName(id) : t === 'dept' ? deptName(id) : ''
  return name || `${typeLabel[t] || type}#${id}`
}
