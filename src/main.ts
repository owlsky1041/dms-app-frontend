import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import { ElMessage } from 'element-plus'

import App from './App.vue'
import router from './router'
import { getUserInfo } from './api/auth'
import { useSiteStore } from './stores/site'
import { useUserStore } from './stores/user'
import './assets/styles/main.scss'

// ============ 前端版本自检 ============
// SPA 一旦打开就会一直执行内存里的旧 JS，后台重新部署后点菜单不会加载新代码，
// 表现为「明明已修复的问题还在」。这里主动比对已部署版本，提示用户刷新。
const RUNNING_BUILD = __BUILD_ID__
console.info(`[DMS] 前端构建号 ${RUNNING_BUILD}`)

let staleNotified = false
async function checkFrontendVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    if (data?.buildId && data.buildId !== RUNNING_BUILD && !staleNotified) {
      staleNotified = true
      ElMessage({
        type: 'warning',
        duration: 0,
        showClose: true,
        message: '系统已更新，当前页面仍是旧版本，请按 Cmd+Shift+R（Windows: Ctrl+F5）刷新'
      })
    }
  } catch {
    // 版本文件缺失或网络异常时静默忽略
  }
}

window.addEventListener('focus', checkFrontendVersion)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkFrontendVersion()
})
setInterval(checkFrontendVersion, 5 * 60 * 1000)

// ============ 启动流程 ============
const app = createApp(App)

// 注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component as any)
}

app.use(createPinia())

/**
 * 挂载前必须完成的准备工作
 *
 * 顺序很关键：vue-router 的 install() 会「立刻」用当前地址发起首次导航并跑路由守卫
 * （见 vue-router 源码里 install 末尾的 push(routerHistory.location)），
 * 所以必须先把角色/权限补好，再 app.use(router)。
 * 否则直接从收藏夹打开 /system/... 时，守卫会拿着空的权限把用户弹回文档页。
 */
async function bootstrap() {
  const site = useSiteStore()
  const user = useUserStore()

  /** 从后端取当前用户的角色与权限；这是权限判断的唯一权威来源 */
  const loadProfile = async () => {
    if (!user.token) return
    try {
      user.applyProfile(await getUserInfo())
    } catch (e) {
      // 拉取失败时按「无权限」处理（少显示入口比误放行安全），
      // 但要明确告知用户，否则会表现成「菜单凭空不见了」这种难以自查的现象
      console.warn('[DMS] 加载用户角色/权限失败，按无权限处理', e)
      ElMessage({
        type: 'warning',
        duration: 0,
        showClose: true,
        message: '未能加载当前用户的权限信息，菜单与功能入口可能显示不全，请刷新页面或重新登录'
      })
    }
  }

  // localStorage 里存的是上次写入的快照，只用于让界面先显示出来，
  // 不能当作权限依据：旧版本存下的记录根本没有 roles/permissions 字段，
  // 后台改过角色本地也不会知道。两者都会让超级管理员被当成普通用户。
  await Promise.all([
    site.load().then(() => site.applyToDocument()),
    loadProfile()
  ])

  app.use(router)
  app.use(ElementPlus, { locale: zhCn })
  app.mount('#app')
}

bootstrap()
