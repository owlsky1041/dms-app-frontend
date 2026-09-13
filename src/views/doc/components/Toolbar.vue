<template>
  <div class="toolbar">
    <div class="left">
      <el-button-group>
        <el-button :icon="Plus" @click="$emit('action', 'newFolder')">新建文件夹</el-button>
        <el-button :icon="Upload" type="primary" @click="$emit('action', 'upload')">上传</el-button>
        <el-button :icon="Refresh" @click="$emit('action', 'refresh')">刷新</el-button>
        <!-- 有授权能力才显示；具体目录能不能改由后端按「完全控制」位判定 -->
        <el-button
          v-if="canConfigPermission"
          :icon="Lock"
          @click="$emit('action', 'permission')"
        >
          权限设置
        </el-button>
        <el-button
          v-if="clipboardCount > 0"
          :icon="CopyDocument"
          type="success"
          @click="$emit('action', 'paste')"
        >
          粘贴 ({{ clipboardCount }})
        </el-button>
      </el-button-group>
      <!--
        「移动到」「删除」不放工具栏：选中项一多容易误点，
        统一收到右键菜单里（Windows 里也是这么做的）。
      -->
    </div>
    <div class="right">
      <el-radio-group v-model="viewModeLocal" size="small">
        <el-radio-button label="list" title="列表"><el-icon><List /></el-icon></el-radio-button>
        <el-radio-button label="tile" title="小图标"><el-icon><Grid /></el-icon></el-radio-button>
        <el-radio-button label="large" title="大图标"><el-icon><Menu /></el-icon></el-radio-button>
      </el-radio-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Plus, Upload, Refresh, Lock, CopyDocument,
  List, Grid, Menu
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  selectedCount: number
  viewMode: 'list' | 'large' | 'tile'
  clipboardCount?: number
}>()

const emit = defineEmits<{
  (e: 'action', action: string): void
  (e: 'view-change', mode: 'list' | 'large' | 'tile'): void
}>()

const viewModeLocal = computed({
  get: () => props.viewMode,
  set: (v) => emit('view-change', v)
})

const userStore = useUserStore()
/** 权限设置入口：持有「权限分配」或「完全控制」权限串即可见（超管为 *:*:*，一并放行） */
const canConfigPermission = computed(() =>
  userStore.hasPermission(['doc:perm:grant', 'doc:perm:full'])
)
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid #ebeef5;
  background: #fafbfc;

  .left {
    display: flex;
    gap: 12px;
  }
}
</style>
