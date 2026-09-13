# DMS 文档管理系统 —— 前端

DMS 的浏览器端界面（Vue 3 + Vite + Element Plus），配套后端
[dms-app](https://github.com/owlsky1041/dms-app)。

## 它负责什么

* **文档浏览**：目录树 + 列表/网格/大图三种视图，右键菜单（打开、下载、重命名、复制/剪切/粘贴、移动、删除、属性），多选批量操作
* **在线预览**：图片（PhotoSwipe 图集）、视频/音频（Plyr，走服务端签名直链）、
  PDF/Office/CAD 等（OnlyOffice iframe；未部署 OnlyOffice 时回落 pdf.js 渲染服务端转好的 PDF）
* **上传**：tus 断点续传（uppy + tus-js-client），大文件中途断网可续传
* **权限**：四档（禁止访问/只读/读写/完全控制）+ 独立下载开关；可授给用户/角色/部门，
  支持继承与到期时间；「权限设置 / 共享给...」入口按授权能力展示
* **系统管理**：用户、角色（含分配权限）、部门、系统参数、审计日志、系统信息、站点配置

## 技术要点（踩过坑的地方）

* **雪花 ID 全程按字符串处理**：19 位 ID 超出 JS 安全整数范围，任何 `Number(id)` 都会丢精度，
  表现为"授权给了 A、实际授给了 B"。后端把 `Long` 统一序列化成字符串，前端不做数值转换。
* **响应信封**：RuoYi 把业务错误包成 `HTTP 200 + {code:500,msg:...}`，
  所以判断成功必须看 `code` 而不是 HTTP 状态码（`src/api/http.ts`）。
* **二进制/流式响应**要先识别再处理，否则下载会被误判为失败。
* **签名直链**：`<img src>` / `<video src>` 带不上 `Authorization` 头，
  必须先向 `/api/doc/files/{id}/media` 换取短期 HMAC 令牌（默认 120 分钟）。
* **权限串与后端一致**：菜单、路由、按钮的显示条件都用权限串（如 `system:audit:list`、
  `doc:perm:grant`），超管为 `*:*:*`；「只有内置超管能做」的入口另用页面级标记。

## 开发与构建

```bash
pnpm install
pnpm dev          # 本地开发（默认代理到后端 http://127.0.0.1:8080）
npx vite build    # 生产构建 → dist/（部署时由 nginx 托管）
```

> 构建只产出静态文件，部署服务器上**不需要** Node.js。

## 与后端的接口约定

* 前端请求的接口路径与后端一一对应：`/api/doc/**`（文档业务）、`/api/perm/**`（权限）、
  `/api/site/**`（站点配置与自助注册）、`/system/**`（RuoYi 框架接口）
* 站点名称、标识图、备案版权等由 `/api/site/config` 提供，登录页在未登录状态下读取

## 许可

与后端一致，基于 [RuoYi-Vue-Plus](https://github.com/dromara/RuoYi-Vue-Plus)（MIT）生态开发，
本仓库代码以 **MIT** 发布。
