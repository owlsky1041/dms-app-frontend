import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSiteConfig } from '@/api/site'

/**
 * 站点配置（站点名称 / 备案 / 版权 / 站点图标）
 *
 * 登录页与主界面共用；应用启动时加载一次并应用到标题与 favicon。
 */
export const useSiteStore = defineStore('site', () => {
  const siteName = ref('DMS 文档管理')
  const icp = ref('')
  const copyright = ref('')
  const faviconUrl = ref('')
  const loaded = ref(false)

  /** 拉取配置（失败时保留默认值，不影响使用） */
  async function load() {
    try {
      const cfg = await getSiteConfig()
      if (cfg?.siteName) siteName.value = cfg.siteName
      icp.value = cfg.icp || ''
      copyright.value = cfg.copyright || ''
      faviconUrl.value = cfg.faviconUrl || ''
      loaded.value = true
    } catch (e) {
      console.warn('[site] 站点配置加载失败，使用默认值', e)
    }
  }

  /** 把站点名称与图标应用到浏览器（标题 + favicon） */
  function applyToDocument() {
    document.title = siteName.value
    if (!faviconUrl.value) return
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = faviconUrl.value
  }

  return { siteName, icp, copyright, faviconUrl, loaded, load, applyToDocument }
})
