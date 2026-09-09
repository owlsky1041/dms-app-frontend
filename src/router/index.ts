import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/views/dashboard/Layout.vue'),
    redirect: '/doc/my-docs',
    children: [
      // 文档管理
      {
        path: 'doc/my-docs',
        name: 'MyDocs',
        component: () => import('@/views/doc/MyDocs.vue'),
        meta: { title: '我的文档', icon: 'Folder' }
      },
      {
        path: 'doc/library',
        name: 'Library',
        component: () => import('@/views/doc/Library.vue'),
        meta: { title: '资料库', icon: 'Repository' }
      },
      {
        path: 'doc/shared',
        name: 'Shared',
        component: () => import('@/views/doc/Shared.vue'),
        meta: { title: '共享给我', icon: 'Share' }
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
        meta: { title: '用户管理', icon: 'User' }
      },
      {
        path: 'system/role',
        name: 'SysRole',
        component: () => import('@/views/system/Role.vue'),
        meta: { title: '角色管理', icon: 'UserFilled' }
      },
      {
        path: 'system/dept',
        name: 'SysDept',
        component: () => import('@/views/system/Dept.vue'),
        meta: { title: '部门管理', icon: 'OfficeBuilding' }
      },
      {
        path: 'system/config',
        name: 'SysConfig',
        component: () => import('@/views/system/Config.vue'),
        meta: { title: '系统参数', icon: 'Setting' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || 'DMS'} - DMS 文档管理系统`
  const userStore = useUserStore()
  if (to.name !== 'Login' && !userStore.isLoggedIn) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

export default router
