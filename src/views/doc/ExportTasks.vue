<template>
  <div class="sys-page">
    <div class="page-header">
      <h3>导出任务</h3>
      <span class="hint">
        体量大的文件夹改为后台打包：提交后可以离开页面，完成后在这里下载。压缩包默认保留 24 小时
      </span>
      <el-button :icon="Refresh" size="small" @click="load">刷新</el-button>
    </div>

    <el-empty v-if="!loading && !tasks.length" description="还没有导出任务" />

    <el-table v-else :data="tasks" v-loading="loading" size="default">
      <el-table-column label="内容" min-width="200">
        <template #default="{ row }">
          <div class="name-cell">
            <el-icon><FolderOpened /></el-icon>
            <span>{{ row.rootName }}</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="150">
        <template #default="{ row }">
          <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          <span v-if="row.skippedCount > 0" class="skip-hint">跳过 {{ row.skippedCount }}</span>
        </template>
      </el-table-column>

      <el-table-column label="进度" min-width="200">
        <template #default="{ row }">
          <el-progress
            v-if="row.status === 'RUNNING' || row.status === 'PENDING'"
            :percentage="row.progress || 0"
            :stroke-width="12"
            striped
            striped-flow
          />
          <span v-else-if="row.status === 'SUCCESS'" class="done-text">
            {{ row.fileCount }} 个文件 · 压缩包 {{ formatSize(row.zipBytes) }}
          </span>
          <span v-else-if="row.errorMsg" class="err-text" :title="row.errorMsg">
            {{ row.errorMsg }}
          </span>
          <span v-else>—</span>
        </template>
      </el-table-column>

      <el-table-column label="提交时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>

      <el-table-column label="有效期" width="170">
        <template #default="{ row }">
          <span v-if="row.status === 'SUCCESS'">{{ formatTime(row.expireTime) }}</span>
          <span v-else>—</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="210" align="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'SUCCESS'"
            size="small"
            type="primary"
            :icon="Download"
            @click="download(row)"
          >
            下载
          </el-button>
          <el-button
            v-if="row.status === 'PENDING'"
            size="small"
            link
            type="warning"
            @click="cancel(row)"
          >
            取消
          </el-button>
          <el-button
            v-if="row.status !== 'RUNNING'"
            size="small"
            link
            type="danger"
            @click="remove(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Download, FolderOpened } from '@element-plus/icons-vue'
import {
  listExportTasks, cancelExportTask, deleteExportTask, downloadExportTask,
  type ExportTask
} from '@/api/doc'
import { notifyError } from '@/api/http'
import dayjs from 'dayjs'

const loading = ref(false)
const tasks = ref<ExportTask[]>([])
let timer: ReturnType<typeof setInterval> | undefined

const STATUS_LABEL: Record<string, string> = {
  PENDING: '排队中',
  RUNNING: '打包中',
  SUCCESS: '已完成',
  FAILED: '失败',
  CANCELED: '已取消',
  EXPIRED: '已过期'
}

function statusLabel(s: string) {
  return STATUS_LABEL[s] || s
}

function statusTagType(s: string) {
  if (s === 'SUCCESS') return 'success'
  if (s === 'RUNNING') return 'primary'
  if (s === 'FAILED') return 'danger'
  if (s === 'PENDING') return 'warning'
  return 'info'
}

function formatTime(t?: string) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '—'
}

function formatSize(bytes?: number) {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

async function load() {
  loading.value = true
  try {
    tasks.value = (await listExportTasks()) || []
  } catch {
    /* http 层已提示 */
  } finally {
    loading.value = false
  }
}

async function download(row: ExportTask) {
  await downloadExportTask(row.taskId, `${row.rootName}.zip`)
  // 刷新一下下载次数
  load()
}

async function cancel(row: ExportTask) {
  try {
    await cancelExportTask(row.taskId)
    ElMessage.success('已取消')
    load()
  } catch (e) {
    notifyError(e, '取消失败')
  }
}

async function remove(row: ExportTask) {
  try {
    await ElMessageBox.confirm(
      row.status === 'SUCCESS'
        ? `删除任务会同时删除已生成的压缩包「${row.rootName}.zip」，确定吗？`
        : '确定删除该导出任务？',
      '确认删除', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteExportTask(row.taskId)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    notifyError(e, '删除失败')
  }
}

onMounted(() => {
  load()
  // 有任务在打包时自动轮询，让进度动起来
  timer = setInterval(() => {
    if (tasks.value.some(t => t.status === 'PENDING' || t.status === 'RUNNING')) {
      load()
    }
  }, 3000)
})

onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.sys-page {
  background: white;
  padding: 20px;
  border-radius: 8px;
  min-height: calc(100vh - 110px);
}
.page-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;

  h3 { margin: 0; font-size: 16px; }
  .hint { color: #909399; font-size: 12px; flex: 1; }
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;

  .el-icon { color: #e6a23c; }
}
.skip-hint {
  margin-left: 6px;
  color: #e6a23c;
  font-size: 12px;
}
.done-text { color: #67c23a; font-size: 13px; }
.err-text {
  color: #f56c6c;
  font-size: 12px;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
