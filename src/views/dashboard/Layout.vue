<template>
  <el-container class="layout">
    <el-header class="header">
      <div class="logo">
        <el-icon :size="24" color="#fff"><Files /></el-icon>
        <span>DMS 文档管理</span>
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
          <el-menu-item index="/doc/library">
            <el-icon><FolderOpened /></el-icon>
            <span>{{ deptAreaName }}</span>
          </el-menu-item>
          <el-menu-item index="/doc/recycle">
            <el-icon><Delete /></el-icon>
            <span>回收站</span>
          </el-menu-item>
          <el-sub-menu index="system">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>系统管理</span>
            </template>
            <el-menu-item index="/system/user">用户管理</el-menu-item>
            <el-menu-item index="/system/role">角色管理</el-menu-item>
            <el-menu-item index="/system/dept">部门管理</el-menu-item>
            <el-menu-item index="/system/config">系统参数</el-menu-item>
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
  Folder, FolderOpened, Share, Delete, Setting
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import ProfileDialog from './ProfileDialog.vue'
import { getDeptArea } from '@/api/doc'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const searchKeyword = ref('')
/** 「部门资料」入口的显示名：跟随实际顶层文档区名称（可被重命名），取不到时退回默认文案 */
const deptAreaName = ref('部门资料')
const profileVisible = ref(false)
const activeMenu = computed(() => route.path)

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

onMounted(async () => {
  try {
    const area = await getDeptArea()
    if (area?.folderName) deptAreaName.value = area.folderName
  } catch { /* 取不到时保留默认文案 */ }
})
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
