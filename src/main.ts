import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import { ElMessage } from 'element-plus'

import App from './App.vue'
import router from './router'
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

const app = createApp(App)

// 注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component as any)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 站点配置：标题、favicon、页头名称（异步，不阻塞挂载）
import('@/stores/site').then(({ useSiteStore }) => {
  const site = useSiteStore()
  site.load().then(() => site.applyToDocument())
})

app.mount('#app')
