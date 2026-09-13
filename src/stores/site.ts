import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSiteConfig } from '@/api/site'

/**
 * 站点配置（站点名称 / 备案 / 版权 / 标签页图标 / 标识图）
 *
 * 登录页与主界面共用；应用启动时加载一次并应用到标题与 favicon。
 */
export const useSiteStore = defineStore('site', () => {
  const siteName = ref('DMS 文档管理')
  const icp = ref('')
  const copyright = ref('')
  const faviconUrl = ref('')
  /** 站点标识图（登录页标题上方、主界面左上角） */
  const logoUrl = ref('')
  /** 是否开放用户自助注册（登录页据此显示「注册账号」入口） */
  const registerEnabled = ref(false)
  /** 找回密码入口是否可用（找回开关 + 邮件配置都就绪） */
  const passwordResetAvailable = ref(false)
  const loaded = ref(false)

  /** 拉取配置（失败时保留默认值，不影响使用） */
  async function load() {
    try {
      const cfg = await getSiteConfig()
      if (cfg?.siteName) siteName.value = cfg.siteName
      icp.value = cfg.icp || ''
      copyright.value = cfg.copyright || ''
      faviconUrl.value = cfg.faviconUrl || ''
      logoUrl.value = cfg.logoUrl || ''
      registerEnabled.value = !!cfg.registerEnabled
      passwordResetAvailable.value = !!cfg.passwordResetAvailable
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

  return {
    siteName,
    icp,
    copyright,
    faviconUrl,
    logoUrl,
    registerEnabled,
    passwordResetAvailable,
    loaded,
    load,
    applyToDocument
  }
})
