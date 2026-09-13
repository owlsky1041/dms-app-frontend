import http from '@/api/http'
import { ElMessage } from 'element-plus'

/**
 * 带登录态的流式下载
 *
 * 为什么不直接用 <a href>：下载接口需要 Authorization 头，浏览器直接跳转带不上。
 * 所以走 axios 取 blob，再用 object URL 触发保存。
 *
 * 为什么要判 JSON：后端拒绝时返回的是 `{code:500,msg:"无下载权限"}`，
 * 而 axios 在 responseType=blob 下会把它包成一个 Blob —— 若不识别，
 * 用户会「下载成功」得到一个内容是错误 JSON 的假文件。
 *
 * 大文件也是安全的：axios 的 blob 响应由浏览器边收边写盘，不在 JS 里囤积整个文件。
 *
 * @param url        下载地址
 * @param fileName   保存的文件名
 * @param postBody   传了就发 POST（多选打包用），否则 GET
 * @returns 是否真的下载成功（被拒绝或失败返回 false）
 */
export async function downloadAsFile(url: string, fileName?: string, postBody?: unknown): Promise<boolean> {
  try {
    const resp = postBody === undefined
      ? await http.get(url, { responseType: 'blob' })
      : await http.post(url, postBody, { responseType: 'blob' })
    const blob = resp.data as Blob

    // 后端拒绝：blob 里其实是一段 JSON
    const type = (blob.type || '').toLowerCase()
    if (type.includes('application/json') || type.includes('text/json')) {
      let msg = '下载失败'
      try {
        msg = JSON.parse(await blob.text())?.msg || msg
      } catch { /* 保底用默认文案 */ }
      ElMessage.error(msg)
      return false
    }
    if (!blob.size) {
      ElMessage.error('文件内容为空或文件已不存在')
      return false
    }

    let name = fileName
    if (!name) {
      // 从 Content-Disposition 里取文件名（后端用 filename*=UTF-8'' 编码）
      const cd = resp.headers?.['content-disposition'] || ''
      const m = /filename\*=UTF-8''([^;]+)/i.exec(cd) || /filename="?([^";]+)"?/i.exec(cd)
      if (m) {
        try {
          name = decodeURIComponent(m[1])
        } catch {
          name = m[1]
        }
      }
    }

    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = name || 'download'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // 立刻 revoke 在部分浏览器会打断下载，延后释放
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
    return true
  } catch (e: any) {
    // 拦截器已经把后端 msg 弹过了，这里只在没有提示过时兜底
    if (!e?.handled) ElMessage.error(e?.message || '下载失败')
    return false
  }
}

/** 下载某个文件 */
export function downloadFileById(fileId: number | string, fileName?: string): Promise<boolean> {
  return downloadAsFile(`/api/doc/files/${fileId}/download`, fileName)
}
