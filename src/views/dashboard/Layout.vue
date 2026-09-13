<template>
  <el-container class="layout">
    <el-header class="header">
      <div class="logo">
        <!-- 与登录页同一张标识图（在「站点配置」里换） -->
        <img v-if="siteStore.logoUrl" class="logo-img" :src="siteStore.logoUrl" :alt="siteStore.siteName" />
        <el-icon v-else :size="24" color="#fff"><Files /></el-icon>
        <span>{{ siteStore.siteName }}</span>
      </div>
      <div class="header-center">
        <el-input
          v-model="searchKeyword"
          placeholder="全局搜索文件..."
          clearable
          @input="onSearchInput"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>
      <div class="header-right">
        <el-dropdown @command="handleCommand">
          <div class="user-info">
            <el-avatar :size="32" :src="userStore.avatar">
              {{ userStore.nickname?.charAt(0) }}
            </el-avatar>
            <span class="nickname">{{ userStore.nickname }}</span>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人中心</el-dropdown-item>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <!-- 个人中心（改资料 / 改密码） -->
    <ProfileDialog v-model:visible="profileVisible" />

    <el-container>
      <el-aside class="aside" width="220px">
        <el-menu
          :default-active="activeMenu"
          :router="true"
          class="side-menu"
          background-color="#001529"
          text-color="#bfcbd9"
          active-text-color="#409eff"
        >
          <el-menu-item index="/doc/all">
            <el-icon><Folder /></el-icon>
            <span>全部文档</span>
          </el-menu-item>
          <el-menu-item index="/doc/export">
            <el-icon><Download /></el-icon>
            <span>导出任务</span>
          </el-menu-item>
          <el-menu-item index="/doc/recycle">
            <el-icon><Delete /></el-icon>
            <span>回收站</span>
          </el-menu-item>
          <!--
            系统管理：按权限动态生成。
            没有任何一项权限时整个子菜单都不渲染，避免普通用户点进去只会看到 403。
          -->
          <el-sub-menu v-if="systemMenus.length" index="system">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>系统管理</span>
            </template>
            <el-menu-item v-for="m in systemMenus" :key="m.path" :index="m.path">
              {{ m.title }}
            </el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-aside>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Files, Search, ArrowDown,
  Folder, Delete, Setting, Download
} from '@element-plus/icons-vue'
import { getUserInfo } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import { useSiteStore } from '@/stores/site'
import ProfileDialog from './ProfileDialog.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

/**
 * 系统管理子菜单：每一项都声明所需权限串，没有权限就不出现
 *
 * 权限串与后端 @SaCheckPermission 一致；超管的 permissions 为 ['*:*:*']，
 * hasPermission 对超管一律放行。
 */
interface SystemMenuDef {
  path: string
  title: string
  /**
   * 需要的权限串，与后端 @SaCheckPermission 一一对应。
   *
   * 数组表示"有一个就够"（后端用 SaMode.OR 的同样语义）。
   * 超管的 permissions 是 ['*:*:*']，hasPermission 对超管一律放行。
   */
  perm?: string | string[]
  /**
   * 整页都是超管专属（与路由 meta.superAdminOnly 对应），目前只有站点配置。
   *
   * 注意这是**页面级**标记，不是"所有超管专属能力"的总开关：
   * 像「清除审计日志」那种只用管住一个按钮/接口的，靠按钮自己的权限串 + 后端硬校验，
   * 不需要也不应该在这里列。审计日志、系统信息已经从超管专属改成权限串了
   * （超管可以把它们授给值班/运维角色）。
   */
  superAdminOnly?: boolean
}

const SYSTEM_MENU_DEFS: SystemMenuDef[] = [
  { path: '/system/user', title: '用户管理', perm: 'system:user:list' },
  { path: '/system/role', title: '角色管理', perm: 'system:role:list' },
  { path: '/system/dept', title: '部门管理', perm: 'system:dept:list' },
  { path: '/system/config', title: '系统参数', perm: 'system:config:list' },
  // 审计日志与系统信息以前是"仅超管可见"，现在由权限串决定：
  // 内置超管可以在「角色管理 → 分配权限」里把这两项勾给别的角色，
  // 这样才有多个人一起维护系统的可能。清除日志仍然只有超管能做。
  { path: '/system/audit', title: '审计日志', perm: 'system:audit:list' },
  { path: '/system/info', title: '系统信息', perm: 'system:info:list' },
  // 站点配置页的读写接口都是超管专属（后端硬校验），所以菜单也跟着收紧，
  // 否则非超管点进去只能看到一堆改不动的控件
  {
    path: '/system/site', title: '站点配置',
    perm: ['system:config:list', 'system:role:list'],
    superAdminOnly: true
  }
]

const systemMenus = computed(() =>
  SYSTEM_MENU_DEFS.filter(m =>
    userStore.hasPermission(m.perm) &&
    (m.superAdminOnly !== true || userStore.isSuperAdmin)
  )
)
const siteStore = useSiteStore()

const searchKeyword = ref('')
const profileVisible = ref(false)
const activeMenu = computed(() => route.path)

/**
 * 兜底：进入主界面时若已登录但角色/权限还是空的，补拉一次
 *
 * 正常情况下 main.ts 在挂载前就补好了，登录时 Login.vue 也会补。
 * 这道网是防「某条路径漏了」——权限为空会让菜单和功能入口莫名消失，
 * 现象难以自查（用户只会看到"菜单不见了"）。
 */
onMounted(async () => {
  if (!userStore.token || userStore.permissions.length) return
  try {
    userStore.applyProfile(await getUserInfo())
  } catch (e) {
    console.warn('[DMS] 兜底加载用户权限失败', e)
  }
})

async function handleCommand(cmd: string) {
  if (cmd === 'profile') {
    profileVisible.value = true
    return
  }
  if (cmd === 'logout') {
    try {
      await ElMessageBox.confirm('确定退出登录?', '提示', { type: 'warning' })
    } catch {
      return
    }
    userStore.logout()
    router.push('/login')
  }
}

function handleSearch() {
  const kw = searchKeyword.value.trim()
  router.push({ name: 'AllDocs', query: kw ? { q: kw } : {} })
}

/** 输入即搜（防抖 400ms），回车立即搜 */
let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const kw = searchKeyword.value.trim()
    // 已在搜索视图且关键词未变时不重复跳转
    if (route.query.q === (kw || undefined)) return
    // 输入过程中的连续变化用 replace，避免污染浏览器历史
    router.replace({ name: 'AllDocs', query: kw ? { q: kw } : {} })
  }, 400)
}

</script>

<style lang="scss" scoped>
.layout {
  height: 100vh;
}

.header {
  background: #001529;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 24px;

  /* 页头高度只有 56px，标识图统一按 26px 等比缩放 */
  .logo .logo-img {
    width: 26px;
    height: 26px;
    object-fit: contain;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 600;
    width: 220px;
  }

  .header-center {
    flex: 1;
    max-width: 480px;
  }

  .header-right {
    margin-left: auto;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: white;

    .nickname { font-size: 14px; }
  }
}

.aside {
  background: #001529;
  height: calc(100vh - 60px);
  overflow: auto;
}

.side-menu {
  border-right: none;
}

.main {
  background: #f5f7fa;
  padding: 0;
}
</style>
