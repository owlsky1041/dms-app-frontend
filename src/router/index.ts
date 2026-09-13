import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { useSiteStore } from '@/stores/site'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { title: '登录' }
  },
  {
    // 是否真的开放由站点配置的 registerEnabled 决定，页面内自行提示
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/Register.vue'),
    meta: { title: '注册账号', public: true }
  },
  {
    path: '/forgot',
    name: 'Forgot',
    component: () => import('@/views/auth/Forgot.vue'),
    meta: { title: '找回密码', public: true }
  },
  {
    path: '/',
    component: () => import('@/views/dashboard/Layout.vue'),
    redirect: '/doc/all',
    children: [
      // 文档管理
      {
        // 不设个人「我的文档」：顶层即公司各文档区
        path: 'doc/all',
        name: 'AllDocs',
        component: () => import('@/views/doc/AllDocs.vue'),
        meta: { title: '全部文档', icon: 'Folder' }
      },
      {
        // 「部门文档」已下线：它取的是"顶层文档区里 folderId 最小的那个"，
        // 与用户部门无关（getDeptArea 里没有任何部门逻辑），点进去和「全部文档」
        // 再往里点一层是同一件事，留着只会让人误以为是本部门专属资料。
        // 保留一条重定向，老书签/旧链接不至于白屏。
        path: 'doc/library',
        redirect: '/doc/all'
      },
      {
        path: 'doc/export',
        name: 'ExportTasks',
        component: () => import('@/views/doc/ExportTasks.vue'),
        meta: { title: '导出任务', icon: 'Download' }
      },
      {
        path: 'doc/recycle',
        name: 'Recycle',
        component: () => import('@/views/doc/Recycle.vue'),
        meta: { title: '回收站', icon: 'Delete' }
      },
      // 系统管理
      {
        path: 'system/user',
        name: 'SysUser',
        component: () => import('@/views/system/User.vue'),
        meta: { title: '用户管理', icon: 'User', perm: 'system:user:list' }
      },
      {
        path: 'system/role',
        name: 'SysRole',
        component: () => import('@/views/system/Role.vue'),
        meta: { title: '角色管理', icon: 'UserFilled', perm: 'system:role:list' }
      },
      {
        path: 'system/dept',
        name: 'SysDept',
        component: () => import('@/views/system/Dept.vue'),
        meta: { title: '部门管理', icon: 'OfficeBuilding', perm: 'system:dept:list' }
      },
      {
        path: 'system/site',
        name: 'SysSite',
        component: () => import('@/views/system/Site.vue'),
        // 站点配置页读的是 /api/site/admin-config、保存走 PUT /api/site/config，
        // 两个接口都是硬校验内置超管的。权限串只用来决定"能不能进这个页面"，
        // 所以这里再补一个 superAdminOnly：否则被授予了「角色管理」的人直接输 URL
        // 就能进到一个所有请求都失败的空页面。
        meta: {
          title: '站点配置', icon: 'Setting',
          perm: ['system:config:list', 'system:role:list'],
          superAdminOnly: true
        }
      },
      {
        path: 'system/audit',
        name: 'SysAudit',
        component: () => import('@/views/system/Audit.vue'),
        // 审计日志仅超管可查（后端也硬校验），所以这里按超管标记，而不是权限串
        meta: { title: '审计日志', icon: 'Document', perm: 'system:audit:list' }
      },
      {
        path: 'system/config',
        name: 'SysConfig',
        component: () => import('@/views/system/Config.vue'),
        meta: { title: '系统参数', icon: 'Setting', perm: 'system:config:list' }
      },
      {
        path: 'system/info',
        name: 'SysInfo',
        component: () => import('@/views/system/Info.vue'),
        // 系统信息里有主机名、目录、内存磁盘余量，属于基础设施信息，仅超管可见
        meta: { title: '系统信息', icon: 'Monitor', perm: 'system:info:list' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  // 站名取自站点配置（可在「站点配置」里改），不能写死——
  // 否则改了站点名称后，只有登录页标题变了，登录之后再翻页又被打回旧名字。
  // 这里和下面的 useUserStore 一样在守卫里取，此时 pinia 已由 main.ts 装好。
  const siteName = useSiteStore().siteName || 'DMS 文档管理'
  document.title = to.meta.title ? `${to.meta.title} - ${siteName}` : siteName
  const userStore = useUserStore()
  // 登录 / 注册 / 找回密码这三个页面允许未登录访问
  const isPublic = to.name === 'Login' || to.meta.public === true
  if (!isPublic && !userStore.isLoggedIn) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }
  // 菜单已按权限隐藏，这里再挡一层：直接输 URL 也会被拦回文档页，
  // 否则会进入一个所有请求都 403 的空页面。
  //
  // superAdminOnly 只给"整个页面对应的后端接口都是超管专属"的路由用，目前只有站点配置。
  // 审计日志/系统信息以前也挂这个标记，现在改成权限串了（超管可以把它们授给别人）；
  // 像「清除审计日志」那种按钮级的兜底能力不在这一层管，它由按钮自身的权限串 +
  // 后端硬校验负责。
  if (to.meta.superAdminOnly === true && !userStore.isSuperAdmin) {
    ElMessage.warning('没有访问该功能的权限')
    next({ path: '/doc/all' })
    return
  }
  const perm = to.meta.perm as string | string[] | undefined
  if (perm && !userStore.hasPermission(perm)) {
    ElMessage.warning('没有访问该功能的权限')
    next({ path: '/doc/all' })
    return
  }
  next()
})

export default router
