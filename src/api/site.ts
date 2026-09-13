import { get, post, put } from './http'

/**
 * 站点配置 API
 *
 * 读接口（配置/图标）是匿名的：登录页在登录前就要展示站点名称、备案/版权与图标，
 * 以及「注册」「忘记密码」入口是否可用。
 * 写接口仅超级管理员可用。
 */

export interface SiteConfig {
  siteName: string
  icp: string
  copyright: string
  /** 浏览器标签页用的 16×16 小图标 */
  favicon?: string | null
  faviconUrl?: string
  /** 登录页标题上方 / 主界面左上角那个标识图（与 favicon 分开，可各传各的） */
  logo?: string | null
  logoUrl?: string
  /** 是否开放用户自助注册 */
  registerEnabled?: boolean
  /** 是否开放邮箱验证码找回密码 */
  resetEnabled?: boolean
  /** 邮件配置是否可用 */
  mailReady?: boolean
  /** 找回密码入口是否可用（开关 + 邮件配置都就绪） */
  passwordResetAvailable?: boolean
}

/** 管理页用的完整配置（含邮件配置，密码仅返回是否已设置） */
export interface SiteAdminConfig extends SiteConfig {
  registerRoleIds?: string
  mailEnabled?: boolean
  mailHost?: string
  mailPort?: number
  mailEncrypt?: 'ssl' | 'starttls' | 'none'
  mailUsername?: string
  mailFrom?: string
  mailFromName?: string
  /** 是否已设置 SMTP 密码；保存时留空表示不修改 */
  mailPasswordSet?: boolean
}

/** 站点配置更新载荷（字段可只提交一部分） */
export interface SiteConfigUpdate {
  siteName?: string
  icp?: string
  copyright?: string
  registerEnabled?: boolean
  registerRoleIds?: string
  resetEnabled?: boolean
  mailEnabled?: boolean
  mailHost?: string
  mailPort?: number
  mailEncrypt?: string
  mailUsername?: string
  /** 空字符串表示保持原密码不变 */
  mailPassword?: string
  mailFrom?: string
  mailFromName?: string
}

/** 读取站点配置（公开） */
export function getSiteConfig(): Promise<SiteConfig> {
  return get('/api/site/config')
}

/** 读取站点配置完整视图（超管） */
export function getSiteAdminConfig(): Promise<SiteAdminConfig> {
  return get('/api/site/admin-config')
}

/** 更新站点配置（超管） */
export function updateSiteConfig(data: SiteConfigUpdate): Promise<SiteAdminConfig> {
  return put('/api/site/config', data)
}

/** 上传站点图标（浏览器标签页小图标，超管） */
export function uploadSiteFavicon(file: File): Promise<SiteAdminConfig> {
  const form = new FormData()
  form.append('file', file)
  return post('/api/site/favicon', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

/**
 * 上传站点标识图（登录页/主界面那个图标，超管）
 *
 * 与 favicon 分开上传：favicon 是标签页上的小图，放大到登录页会糊；
 * 这张是给人看的，建议 128×128 以上的正方形。
 */
export function uploadSiteLogo(file: File): Promise<SiteAdminConfig> {
  const form = new FormData()
  form.append('file', file)
  return post('/api/site/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

/** 发送邮件配置测试邮件（超管） */
export function testSiteMail(to: string): Promise<void> {
  return post('/api/site/mail/test', { to })
}

// ==================== 用户自助：注册 / 找回密码（公开） ====================

export interface SiteRegisterPayload {
  username: string
  password: string
  confirmPassword: string
  nickName?: string
  email?: string
  phoneNumber?: string
}

/** 用户自助注册 */
export function siteRegister(data: SiteRegisterPayload): Promise<void> {
  return post('/api/site/register', data)
}

export interface ResetCodeResult {
  validMinutes: number
  maskedEmail: string
  message: string
}

/** 申请找回密码验证码（发送到账号绑定邮箱） */
export function sendResetCode(account: string): Promise<ResetCodeResult> {
  return post('/api/site/password/code', { account })
}

/** 使用邮件验证码重置密码 */
export function resetPasswordByCode(data: {
  account: string
  code: string
  password: string
  confirmPassword: string
}): Promise<void> {
  return post('/api/site/password/reset', data)
}
