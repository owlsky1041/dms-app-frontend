import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

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
http.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
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
      return Promise.reject(new Error(res.msg || 'Error'))
    }
    return response
  },
  (error) => {
    const msg = error.response?.data?.msg || error.message || '网络异常'
    ElMessage.error(msg)
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
