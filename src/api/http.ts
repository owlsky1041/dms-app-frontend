import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

/**
 * 已由响应拦截器弹过提示的错误
 *
 * 拦截器负责把后端 msg 弹出来，业务代码的 catch 里若再弹一次就会重复。
 * 约定：catch 到带 handled=true 的错误时，只在需要时展示补充信息。
 */
export interface HandledError extends Error {
  handled?: boolean
}

/** 仅当错误未被拦截器提示过时才弹提示（避免同一条错误出现两次） */
export function notifyError(e: any, fallback = '操作失败'): void {
  if (e?.handled) return
  ElMessage.error(e?.message || e?.msg || fallback)
}

/**
 * 后端统一响应格式
 */
export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
  timestamp?: number
}

/**
 * RuoYi-Vue-Plus 客户端 ID（对应 sys_client 表的 client_id，pc 端）
 * 请求需带 clientid header，否则 401 "客户端ID与Token不匹配"
 */
export const CLIENT_ID = 'e5cd7e4891bf95d1d19206ce24a7b32e'

/**
 * 创建 axios 实例
 * baseURL 为空：URL 由调用方决定
 *   - 登录:  /auth/login（RuoYi 原生，无 /api 前缀）
 *   - 系统:  /system/user 等（RuoYi 原生）
 *   - doc:   /api/doc/...（doc 模块带 /api 前缀）
 */
const http: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    // RuoYi 6.0 客户端校验头（必需）
    'clientid': CLIENT_ID
  }
})

/**
 * 请求拦截器：自动加 JWT（Bearer 前缀）
 */
http.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

/**
 * 响应拦截器：统一处理 code 和异常
 */
/**
 * 这个响应是不是「RuoYi 的 JSON 信封」
 *
 * 下载/预览这类接口返回的是原始字节（responseType: 'blob'），
 * 拿不到 code 字段。若不区分就直接判 `res.code !== 200`，
 * 下载永远会被误判成失败并弹「请求失败」。
 */
function isRuoYiEnvelope(response: AxiosResponse): boolean {
  const rt = (response.config as any)?.responseType
  if (rt === 'blob' || rt === 'arraybuffer' || rt === 'stream') return false
  const data: any = response.data
  if (data instanceof Blob || data instanceof ArrayBuffer) return false
  if (typeof data !== 'object' || data === null) return false
  return 'code' in data
}

http.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    if (!isRuoYiEnvelope(response)) {
      // 二进制/流式响应原样返回，由调用方处理
      return response
    }
    const res = response.data
    if (res.code !== 200) {
      // 401 未登录 → 静默登出跳登录页（避免登录请求本身也弹错）
      if (res.code === 401) {
        const userStore = useUserStore()
        if (userStore.token) {
          userStore.logout()
          window.location.hash = '#/login'
        }
        return Promise.reject(new Error(res.msg || '未登录'))
      }
      ElMessage.error(res.msg || '请求失败')
      // 标记「已提示过」：调用方的 catch 不应再弹一次，
      // 否则同一个错误会连弹两条（例如保存失败时出现两遍同样的红字）
      const err = new Error(res.msg || 'Error') as HandledError
      err.handled = true
      return Promise.reject(err)
    }
    return response
  },
  async (error) => {
    // blob 请求出错时，后端返回的其实是 JSON（被 axios 包成了 Blob），
    // 这里读出来，避免提示变成「网络异常」这种无用信息
    let msg = error.message || '网络异常'
    const data = error.response?.data
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text())
        msg = parsed?.msg || msg
      } catch { /* 不是 JSON 就用原始信息 */ }
    } else if (data?.msg) {
      msg = data.msg
    }
    ElMessage.error(msg)
    ;(error as HandledError).handled = true
    return Promise.reject(error)
  }
)

/**
 * 通用请求方法
 */
export function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  return http.request<ApiResponse<T>>(config).then((res) => res.data.data)
}

export function get<T = unknown>(url: string, params?: any): Promise<T> {
  return request<T>({ method: 'GET', url, params })
}

export function post<T = unknown>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return request<T>({ method: 'POST', url, data, ...config })
}

export function put<T = unknown>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return request<T>({ method: 'PUT', url, data, ...config })
}

export function del<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return request<T>({ method: 'DELETE', url, ...config })
}

export default http
