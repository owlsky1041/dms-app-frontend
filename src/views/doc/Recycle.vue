<template>
  <div class="recycle-page">
    <div class="recycle-header">
      <div class="title">
        <el-icon><Delete /></el-icon>
        <span>回收站</span>
        <el-tag size="small" type="info">保留 {{ totalCount }} 项</el-tag>
        <el-tooltip v-if="retentionDays > 0" :content="retentionTip" placement="bottom">
          <el-tag size="small" type="warning">
            <el-icon><Timer /></el-icon>
            超过 {{ retentionDays }} 天自动清理
          </el-tag>
        </el-tooltip>
      </div>
      <div class="actions">
        <el-button size="small" :icon="Refresh" @click="loadRecycle">刷新</el-button>
        <el-popconfirm
          title="确定清空回收站？将永久删除所有项目"
          confirm-button-text="清空"
          cancel-button-text="取消"
          @confirm="handleEmpty"
        >
          <template #reference>
            <el-button size="small" type="danger" :icon="Delete" :disabled="totalCount === 0">
              清空回收站
            </el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>

    <el-empty v-if="totalCount === 0 && !loading" description="回收站是空的" />

    <!-- 已删文件夹 -->
    <div v-if="folders.length" class="recycle-section">
      <div class="section-title">文件夹</div>
      <el-table :data="folders" size="default" @row-contextmenu="() => {}">
        <el-table-column label="名称" min-width="250">
          <template #default="{ row }">
            <div class="cell-icon">
              <el-icon color="#e6a23c"><Folder /></el-icon>
              <span>{{ row.folderName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="删除时间" width="180">
          <template #default="{ row }">{{ formatDate(row.deletedAt || row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link :icon="RefreshLeft" @click="restoreFolder(row)">
              恢复
            </el-button>
            <el-popconfirm
              title="永久删除该文件夹及全部内容？不可恢复！"
              confirm-button-text="永久删除"
              @confirm="purgeFolder(row)"
            >
              <template #reference>
                <el-button size="small" type="danger" link :icon="Delete">永久删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 已删文件 -->
    <div v-if="files.length" class="recycle-section">
      <div class="section-title">文件</div>
      <el-table :data="files" size="default">
        <el-table-column label="名称" min-width="250">
          <template #default="{ row }">
            <div class="cell-icon">
              <el-icon color="#909399"><Document /></el-icon>
              <span>{{ row.fileName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ row.fileExtension || '—' }}</template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ formatSize(row.fileSize) }}</template>
        </el-table-column>
        <el-table-column label="删除时间" width="180">
          <template #default="{ row }">{{ formatDate(row.deletedAt || row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link :icon="RefreshLeft" @click="restoreFile(row)">
              恢复
            </el-button>
            <el-popconfirm
              title="永久删除该文件？不可恢复！"
              confirm-button-text="永久删除"
              @confirm="purgeFile(row)"
            >
              <template #reference>
                <el-button size="small" type="danger" link :icon="Delete">永久删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Refresh, Folder, Document, RefreshLeft, Timer } from '@element-plus/icons-vue'
import {
  listRecycle, restoreRecycleFile, restoreRecycleFolder,
  purgeRecycleFile, purgeRecycleFolder, emptyRecycle
} from '@/api/doc'
import type { Folder as FolderType, DocFile } from '@/types/doc'
import dayjs from 'dayjs'

const loading = ref(false)
const folders = ref<FolderType[]>([])
const files = ref<DocFile[]>([])
const totalCount = computed(() => folders.value.length + files.value.length)
/** 保留天数（来自后端 dms.recycle.retention-days；<=0 表示不自动清理） */
const retentionDays = ref(0)
const retentionTip = computed(
  () => `回收站项目在删除满 ${retentionDays.value} 天后会被系统自动永久删除，` +
        '届时文件与其存储对象一并清除、无法恢复。需要长期保留的请及时「恢复」。'
)

async function loadRecycle() {
  loading.value = true
  try {
    const data = await listRecycle()
    folders.value = data.folders || []
    files.value = data.files || []
    retentionDays.value = Number(data.retentionDays ?? 0)
  } catch (e) {
    ElMessage.error('加载回收站失败')
  } finally {
    loading.value = false
  }
}

async function restoreFile(row: DocFile) {
  await restoreRecycleFile(row.fileId)
  ElMessage.success(`已恢复 ${row.fileName}`)
  loadRecycle()
}

async function restoreFolder(row: FolderType) {
  await restoreRecycleFolder(row.folderId)
  ElMessage.success(`已恢复 ${row.folderName}`)
  loadRecycle()
}

async function purgeFile(row: DocFile) {
  await purgeRecycleFile(row.fileId)
  ElMessage.success(`已永久删除 ${row.fileName}`)
  loadRecycle()
}

async function purgeFolder(row: FolderType) {
  await purgeRecycleFolder(row.folderId)
  ElMessage.success(`已永久删除 ${row.folderName}`)
  loadRecycle()
}

async function handleEmpty() {
  try {
    await ElMessageBox.confirm('将永久删除回收站内所有内容，此操作不可撤销！', '清空回收站', {
      type: 'warning',
      confirmButtonText: '确认清空'
    })
  } catch {
    return
  }
  await emptyRecycle()
  ElMessage.success('回收站已清空')
  loadRecycle()
}

function formatDate(date?: string) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '—'
}

function formatSize(bytes: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

onMounted(loadRecycle)
</script>

<style lang="scss" scoped>
.recycle-page {
  background: white;
  height: calc(100vh - 100px);
  overflow: auto;
  padding: 20px;
  border-radius: 8px;

  .recycle-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 600;
    }
  }

  .recycle-section {
    margin-bottom: 24px;

    .section-title {
      font-size: 14px;
      color: #909399;
      margin-bottom: 8px;
      padding-left: 4px;
    }
  }

  .cell-icon {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
