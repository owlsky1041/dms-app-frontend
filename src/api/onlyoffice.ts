import { get } from './http'

/**
 * OnlyOffice 在线查看
 *
 * 后端返回编辑器配置（含服务端取文档用的临时签名地址），前端只负责加载 api.js 并初始化。
 */
export interface OnlyOfficePayload {
  /** 文档服务地址（浏览器访问） */
  dsUrl: string
  /** OnlyOffice 编辑器配置 */
  config: Record<string, any>
  /** 水印配置（已按当前登录用户解析占位符） */
  watermark?: { enabled: boolean; text: string }
  canDownload?: boolean
}

export function getOnlyOfficeConfig(fileId: number | string): Promise<OnlyOfficePayload> {
  return get('/api/onlyoffice/config', { fileId })
}

/** 水印配置（内容来自系统参数，支持真实姓名/账户占位符） */
export function getWatermarkConfig(): Promise<{ enabled: boolean; text: string }> {
  return get('/api/onlyoffice/watermark')
}
