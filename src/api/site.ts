import { get, post, put } from './http'

/**
 * 站点配置 API
 *
 * 读接口（配置/图标）是匿名的：登录页在登录前就要展示站点名称、备案/版权与图标。
 * 写接口仅超级管理员可用。
 */

export interface SiteConfig {
  siteName: string
  icp: string
  copyright: string
  favicon?: string | null
  faviconUrl?: string
}

/** 读取站点配置（公开） */
export function getSiteConfig(): Promise<SiteConfig> {
  return get('/api/site/config')
}

/** 更新站点配置（超管） */
export function updateSiteConfig(data: { siteName?: string; icp?: string; copyright?: string }): Promise<SiteConfig> {
  return put('/api/site/config', data)
}

/** 上传站点图标（超管） */
export function uploadSiteFavicon(file: File): Promise<SiteConfig> {
  const form = new FormData()
  form.append('file', file)
  return post('/api/site/favicon', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
