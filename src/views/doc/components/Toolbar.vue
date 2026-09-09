<template>
  <div class="toolbar">
    <div class="left">
      <el-button-group>
        <el-button :icon="Plus" @click="$emit('action', 'newFolder')">新建文件夹</el-button>
        <el-button :icon="Upload" type="primary" @click="$emit('action', 'upload')">上传</el-button>
        <el-button :icon="Refresh" @click="$emit('action', 'refresh')">刷新</el-button>
        <el-button :icon="Lock" @click="$emit('action', 'permission')">权限设置</el-button>
        <el-button
          v-if="clipboardCount > 0"
          :icon="CopyDocument"
          type="success"
          @click="$emit('action', 'paste')"
        >
          粘贴 ({{ clipboardCount }})
        </el-button>
      </el-button-group>
      <el-button
        v-if="selectedCount > 0"
        :icon="FolderOpened"
        type="primary"
        plain
        @click="$emit('action', 'move')"
      >
        移动到
      </el-button>
      <el-button
        v-if="selectedCount > 0"
        :icon="Delete"
        type="danger"
        @click="$emit('action', 'delete')"
      >
        删除 ({{ selectedCount }})
      </el-button>
    </div>
    <div class="right">
      <el-radio-group v-model="viewModeLocal" size="small">
        <el-radio-button label="list"><el-icon><List /></el-icon></el-radio-button>
        <el-radio-button label="large"><el-icon><Grid /></el-icon></el-radio-button>
        <el-radio-button label="tile"><el-icon><Menu /></el-icon></el-radio-button>
      </el-radio-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Plus, Upload, Refresh, Delete, Lock, CopyDocument, FolderOpened,
  List, Grid, Menu
} from '@element-plus/icons-vue'

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
