<template>
  <div class="sys-page">
    <div class="page-header">
      <h3>审计日志</h3>
      <span class="hint">
        记录上传、下载、打包下载、授权/撤销、删除等敏感操作；只记录不提供修改入口
      </span>
      <div class="header-actions">
        <el-button v-if="canExport" :icon="Download" @click="doExport" :loading="exporting">导出日志</el-button>
        <!-- 清除不可逆且会毁掉追责证据，只留给内置超管；其他人连按钮都看不到 -->
        <el-button v-if="userStore.isSuperAdmin" :icon="Delete" type="danger" plain @click="openClear">
          清除日志
        </el-button>
      </div>
    </div>

    <div class="filters">
      <el-select v-model="query.action" placeholder="全部动作" clearable style="width: 170px" @change="reload">
        <el-option v-for="a in actions" :key="a.code" :label="a.label" :value="a.code" />
      </el-select>
      <el-date-picker
        v-model="range"
        type="daterange"
        unlink-panels
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 250px"
        @change="reload"
      />
      <el-button :icon="Refresh" @click="reload">刷新</el-button>
      <span class="filter-hint">导出与清除都只作用于当前筛选范围</span>
    </div>

    <!--
      表格自己滚（height 固定），页面本体不滚：
      否则 20 行日志就把分页器顶到屏幕外面去，得整页滚才能翻页。
    -->
    <div class="table-wrap">
      <el-table
        :data="rows"
        v-loading="loading"
        size="default"
        height="100%"
        @row-click="showDetail"
      >
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作人" width="90" show-overflow-tooltip>
          <template #default="{ row }">{{ displayUserName(row.userId) }}</template>
        </el-table-column>
        <el-table-column label="动作" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="actionTagType(row.action)">{{ actionLabel(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="对象" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="obj">
              <span v-if="row.resourceType" class="type">{{ row.resourceType }}</span>
              {{ row.resourcePath || row.resourceId || '—' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="IP" width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.ip || '—' }}</template>
        </el-table-column>
        <el-table-column label="详情" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="detail">{{ summarize(row.detail) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pager">
      <el-pagination
        v-model:current-page="page.current"
        v-model:page-size="page.size"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @size-change="reload"
        @current-change="load"
      />
    </div>

    <!-- 详情弹窗：detail 是 JSON，直接看表格太挤 -->
    <el-dialog v-model="detailVisible" title="审计详情" width="min(720px, 92vw)" class="audit-detail">
      <el-descriptions v-if="current" :column="1" border size="small">
        <el-descriptions-item label="时间">{{ formatTime(current.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ displayUserName(current.userId) }}（{{ current.userId }}）</el-descriptions-item>
        <el-descriptions-item label="动作">{{ actionLabel(current.action) }}（{{ current.action }}）</el-descriptions-item>
        <el-descriptions-item label="对象">{{ current.resourceType }} #{{ current.resourceId }}</el-descriptions-item>
        <el-descriptions-item label="名称/路径">{{ current.resourcePath || '—' }}</el-descriptions-item>
        <el-descriptions-item label="IP">{{ current.ip || '—' }}</el-descriptions-item>
        <el-descriptions-item label="User-Agent">
          <span class="ua">{{ current.userAgent || '—' }}</span>
        </el-descriptions-item>
      </el-descriptions>
      <pre v-if="current?.detail" class="json">{{ prettyDetail(current.detail) }}</pre>
    </el-dialog>

    <!-- 清除日志：不可逆，所以要求先看清范围再确认 -->
    <el-dialog v-model="clearVisible" title="清除审计日志" width="min(560px, 92vw)" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" show-icon title="清除后无法恢复">
        <template #default>
          审计日志用于事后追溯，清理前建议先「导出日志」留档。
        </template>
      </el-alert>

      <el-radio-group v-model="clearScope" class="clear-scope">
        <el-radio value="filtered">
          按当前筛选清除
          <span class="scope-desc">
            {{ filterText }}，共 <b>{{ matchedCount ?? '…' }}</b> 条
          </span>
        </el-radio>
        <el-radio value="all">
          清空全部日志
          <span class="scope-desc danger">共 <b>{{ totalAll ?? '…' }}</b> 条，删除后什么都没有了</span>
        </el-radio>
      </el-radio-group>

      <div class="clear-tip">
        清除动作本身会记一条「清除审计日志」留痕，这条不会被一起删掉。
      </div>

      <template #footer>
        <el-button @click="clearVisible = false">取消</el-button>
        <el-button type="danger" :loading="clearing" @click="doClear">
          {{ clearScope === 'all' ? '确认清空全部' : '确认清除' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Download, Delete } from '@element-plus/icons-vue'
import {
  listAuditActions, listAuditLogs, exportAuditLogs, clearAuditLogs, countAuditLogs,
  type AuditRow, type AuditFilter
} from '@/api/doc'
import { notifyError } from '@/api/http'
import { useUserStore } from '@/stores/user'
import { displayUserName, ensureNames } from '@/utils/subjectNames'
import dayjs from 'dayjs'

const userStore = useUserStore()

/**
 * 导出要单独的权限串（system:audit:export）
 *
 * 查看日志和把日志带走是两件事：值班的人需要看，但不一定需要能把整份记录导出成
 * 文件带走。所以后端拆成两个权限串，这里也拆开——没权限就不显示按钮，
 * 而不是点了才报错。
 */
const canExport = computed(() => userStore.hasPermission('system:audit:export'))

const loading = ref(false)
const exporting = ref(false)
const clearing = ref(false)
const rows = ref<AuditRow[]>([])
const total = ref(0)
const actions = ref<Array<{ code: string; label: string }>>([])
const range = ref<[string, string] | null>(null)
const detailVisible = ref(false)
const current = ref<AuditRow | null>(null)
const page = reactive({ current: 1, size: 20 })
const query = reactive({ action: '' })

const clearVisible = ref(false)
const clearScope = ref<'filtered' | 'all'>('filtered')
const matchedCount = ref<number | null>(null)
const totalAll = ref<number | null>(null)

const ACTION_FALLBACK: Record<string, string> = {
  DOWNLOAD: '下载',
  PERM_GRANT: '授权',
  PERM_REVOKE: '撤销授权',
  PERMANENT_DELETE: '永久删除',
  AUDIT_EXPORT: '导出审计日志',
  AUDIT_CLEAR: '清除审计日志'
}

function actionLabel(code: string) {
  return actions.value.find(a => a.code === code)?.label || ACTION_FALLBACK[code] || code
}

/** 下载与永久删除是重点，用颜色区分出来；动日志本身的操作也标出来 */
function actionTagType(code: string) {
  if (code === 'DOWNLOAD') return 'success'
  if (code === 'PERMANENT_DELETE' || code === 'AUDIT_CLEAR') return 'danger'
  if (code === 'PERM_GRANT' || code === 'PERM_REVOKE') return 'warning'
  if (code === 'AUDIT_EXPORT') return 'primary'
  return 'info'
}

function formatTime(t?: string) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '—'
}

function prettyDetail(d: string) {
  try {
    return JSON.stringify(JSON.parse(d), null, 2)
  } catch {
    return d
  }
}

/** 列表里只给一行摘要，完整内容点开看 */
function summarize(d?: string) {
  if (!d) return '—'
  try {
    const o = JSON.parse(d)
    const parts: string[] = []
    if (o.rootName) parts.push(`包:${o.rootName}`)
    if (o.fileName) parts.push(`文件:${o.fileName}`)
    if (o.writtenFiles !== undefined) parts.push(`写出 ${o.writtenFiles} 个`)
    if (o.skippedByPermission) parts.push(`因权限跳过 ${o.skippedByPermission} 个`)
    if (o.permText) parts.push(`权限:${o.permText}`)
    if (o.subjectType) parts.push(`主体:${o.subjectType}#${o.subjectId}`)
    if (o.removedObjects !== undefined) parts.push(`清理对象 ${o.removedObjects} 个`)
    if (o.rows !== undefined) parts.push(`导出 ${o.rows} 行`)
    if (o.deleted !== undefined) parts.push(`清除 ${o.deleted} 条`)
    return parts.length ? parts.join('，') : d.slice(0, 80)
  } catch {
    return d.slice(0, 80)
  }
}

function showDetail(row: AuditRow) {
  current.value = row
  detailVisible.value = true
}

/** 当前筛选条件（列表/导出/计数/清除共用，避免"看到的"和"删掉的"不是一批） */
const filter = computed<AuditFilter>(() => ({
  action: query.action || undefined,
  beginDay: range.value?.[0],
  endDay: range.value?.[1]
}))

/** 筛选条件的人话描述，放在清除确认框里 */
const filterText = computed(() => {
  const parts: string[] = []
  parts.push(query.action ? `动作「${actionLabel(query.action)}」` : '全部动作')
  if (range.value?.[0]) parts.push(`${range.value[0]} 至 ${range.value[1]}`)
  return parts.join('，')
})

/** 改筛选条件时回到第一页，否则可能停在一个已不存在的页码上看到空列表 */
function reload() {
  page.current = 1
  load()
}

async function load() {
  loading.value = true
  try {
    const res = await listAuditLogs({
      ...filter.value,
      pageNum: page.current,
      pageSize: page.size
    })
    rows.value = res?.rows || []
    total.value = res?.total || 0
    // 操作人显示真实姓名
    ensureNames('user', rows.value.map(r => r.userId))
  } catch {
    /* http 层已提示 */
  } finally {
    loading.value = false
  }
}

async function loadActions() {
  try {
    actions.value = await listAuditActions()
  } catch { /* 拉不到就用兜底文案 */ }
}

async function doExport() {
  exporting.value = true
  try {
    // 文件名交给后端 Content-Disposition（带时间戳，多次导出不会互相覆盖）
    const ok = await exportAuditLogs(filter.value)
    if (ok) ElMessage.success('已开始导出')
    // 导出本身会写一条审计记录，刷新一下让它显示出来
    if (ok) await load()
  } finally {
    exporting.value = false
  }
}

async function openClear() {
  clearScope.value = 'filtered'
  matchedCount.value = null
  totalAll.value = null
  clearVisible.value = true
  // 先问后端有多少条：清空是不可逆的，得让用户看到数量再点
  try {
    const [matched, all] = await Promise.all([
      countAuditLogs(filter.value),
      countAuditLogs({})
    ])
    matchedCount.value = matched
    totalAll.value = all
  } catch (e) {
    notifyError(e, '统计日志条数失败')
  }
}

async function doClear() {
  const isAll = clearScope.value === 'all'
  const n = isAll ? totalAll.value : matchedCount.value
  try {
    await ElMessageBox.confirm(
      isAll
        ? `将删除全部 ${n ?? ''} 条审计日志，且无法恢复。确定吗？`
        : `将删除当前筛选（${filterText.value}）下的 ${n ?? ''} 条日志，且无法恢复。确定吗？`,
      isAll ? '清空全部日志' : '清除日志',
      { type: 'warning', confirmButtonText: isAll ? '确认清空' : '确认清除' }
    )
  } catch {
    return
  }
  clearing.value = true
  try {
    const res = await clearAuditLogs(isAll ? { all: true } : filter.value)
    ElMessage.success(`已清除 ${res?.deleted ?? 0} 条`)
    clearVisible.value = false
    page.current = 1
    await load()
  } catch (e) {
    notifyError(e, '清除失败')
  } finally {
    clearing.value = false
  }
}

onMounted(() => { loadActions(); load() })
</script>

<style scoped>
/*
 * 整页固定高度 + 只有表格区滚动
 *
 * 之前用 min-height，页面被 20 行日志撑到 1300+px，分页器跑到屏幕外，
 * 得先滚到底才能翻页；列宽之和（1040px）在 1280 宽的窗口里还会横向溢出
 * （表格容器 1012px < 内容 1040px）。现在：外框固定、表格自己滚、列宽压到
 * 最多 830px，1024 宽的窗口也放得下。
 */
.sys-page {
  background: white;
  padding: 20px;
  border-radius: 8px;
  height: calc(100vh - 110px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;

  h3 { margin: 0; font-size: 16px; }
  .hint { color: #909399; font-size: 12px; flex: 1; min-width: 200px; }
  .header-actions { margin-left: auto; display: flex; gap: 8px; }
}
.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  align-items: center;
  flex-wrap: wrap;

  .filter-hint { color: #c0c4cc; font-size: 12px; }
}
/* 表格区：flex:1 + min-height:0 才能让 el-table height="100%" 算出正确高度 */
.table-wrap {
  flex: 1;
  min-height: 0;
}
.pager {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}
.obj .type {
  display: inline-block;
  min-width: 52px;
  margin-right: 6px;
  color: #909399;
  font-size: 12px;
}
.detail {
  color: #606266;
  font-size: 12px;
}
.json {
  margin-top: 14px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
/* User-Agent 很长，允许换行，别把弹窗顶宽 */
.ua {
  word-break: break-all;
}
.clear-scope {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  margin-top: 14px;

  :deep(.el-radio) {
    height: auto;
    margin-right: 0;
    padding: 8px 0;
    align-items: flex-start;
  }
  :deep(.el-radio__label) {
    display: flex;
    flex-direction: column;
    gap: 2px;
    white-space: normal;
    line-height: 1.5;
  }
  .scope-desc {
    color: #909399;
    font-size: 12px;

    &.danger { color: #f56c6c; }
  }
}
.clear-tip {
  margin-top: 10px;
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
}
:deep(.el-table__row) { cursor: pointer; }
</style>
