import { post, get, CLIENT_ID } from './http'
import type { ApiResponse } from './http'

/** 登录响应 */
export interface LoginResult {
  access_token: string
  client_id: string
  expire_in: number
  openid?: string
  refresh_expire_in?: number
  refresh_token?: string
}

/** 用户信息 */
export interface UserInfo {
  user: {
    userId: number | string
    deptId: number | string
    userName: string
    nickName: string
    avatar?: string
  }
  roles: string[]
  permissions: string[]
}

/**
 * 登录（RuoYi-Vue-Plus 6.0）
 */
export function login(username: string, password: string): Promise<LoginResult> {
  return post<LoginResult>('/auth/login', {
    username,
    password,
    clientId: CLIENT_ID,
    grantType: 'password'
  })
}

/**
 * 获取当前登录用户信息
 */
export function getUserInfo(): Promise<UserInfo> {
  return get<UserInfo>('/auth/info')
}

/**
 * 登出
 */
export function logout(): Promise<void> {
  return post('/auth/logout')
}
