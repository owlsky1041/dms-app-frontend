<template>
  <div class="sys-page">
    <div class="page-header">
      <h3>系统信息</h3>
      <span class="hint">
        服务器、应用、数据库、对象存储的运行状态；采集时间 {{ info?.collectedAt || '—' }}
      </span>
      <div class="header-actions">
        <el-switch v-model="auto" active-text="自动刷新" @change="onAutoChange" />
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
      </div>
    </div>

    <div class="page-scroll" v-loading="loading && !info">
      <el-alert
        v-if="loadError"
        type="error"
        :closable="false"
        show-icon
        :title="'采集系统信息失败：' + loadError"
        description="后端接口 /api/doc/system/info 不可用时无法显示；本页仅超级管理员可访问。"
        style="margin-bottom: 16px"
      />

      <div class="grid" v-if="info">
        <!-- ==================== 业务数据量（放最前：最常问的是"系统里有多少东西"） ==================== -->
        <section class="card wide">
          <div class="card-title"><el-icon><Document /></el-icon>业务数据量</div>
          <div class="stats">
            <div class="stat">
              <span class="num">{{ info.business.files ?? 0 }}</span>
              <span class="lbl">文档（不含回收站）</span>
            </div>
            <div class="stat">
              <span class="num">{{ info.business.folders ?? 0 }}</span>
              <span class="lbl">文件夹</span>
            </div>
            <div class="stat">
              <span class="num">{{ formatSize(info.business.totalFileBytes) }}</span>
              <span class="lbl">文档总占用</span>
            </div>
            <div class="stat">
              <span class="num">{{ formatSize(info.business.largestFileBytes) }}</span>
              <span class="lbl">最大单个文件</span>
            </div>
            <div class="stat">
              <span class="num">{{ (info.business.recycleFiles ?? 0) + (info.business.recycleFolders ?? 0) }}</span>
              <span class="lbl">回收站（文件+目录）</span>
            </div>
            <div class="stat">
              <span class="num">{{ info.business.exportTasks ?? 0 }}</span>
              <span class="lbl">导出任务</span>
            </div>
            <div class="stat">
              <span class="num">{{ formatNumber(info.business.auditLogs) }}</span>
              <span class="lbl">审计记录</span>
            </div>
          </div>

          <div class="biz-cols">
            <div>
              <div class="sub-title">账号与权限</div>
              <el-descriptions :column="1" size="small" border>
                <el-descriptions-item label="用户">{{ formatNumber(info.business.users) }} 人</el-descriptions-item>
                <el-descriptions-item label="部门">{{ formatNumber(info.business.depts) }} 个</el-descriptions-item>
                <el-descriptions-item label="角色">{{ formatNumber(info.business.roles) }} 个</el-descriptions-item>
                <el-descriptions-item label="目录授权">
                  {{ formatNumber(info.business.folderGrants) }} 条
                  <span class="tip">（单个目录/文件上直接授予的，不含继承）</span>
                </el-descriptions-item>
                <el-descriptions-item label="文件授权">
                  {{ formatNumber(info.business.fileGrants) }} 条
                </el-descriptions-item>
              </el-descriptions>
            </div>
            <div>
              <div class="sub-title">文件构成（按扩展名）</div>
              <el-table
                v-if="fileExtRows.length"
                :data="fileExtRows"
                size="small"
                max-height="220"
              >
                <el-table-column prop="label" label="类型" width="120" />
                <el-table-column prop="cnt" label="个数" width="80" />
                <el-table-column label="占用">
                  <template #default="{ row }">{{ formatSize(row.bytes) }}</template>
                </el-table-column>
              </el-table>
              <div v-else class="tip">暂无文档</div>
            </div>
          </div>
        </section>

        <!-- ==================== 服务器 ==================== -->
        <section class="card">
          <div class="card-title"><el-icon><Monitor /></el-icon>服务器</div>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="主机名">{{ info.server.hostName || '—' }}</el-descriptions-item>
            <el-descriptions-item label="操作系统">
              {{ info.server.osPrettyName || info.server.osName }}
            </el-descriptions-item>
            <el-descriptions-item label="发行版/内核">
              {{ kernelText }}
            </el-descriptions-item>
            <el-descriptions-item label="CPU">
              {{ info.server.cpuCores }} 核（{{ info.server.cpuArch || info.server.osArch }}）
            </el-descriptions-item>
            <el-descriptions-item label="CPU 型号">
              <span class="ellipsis" :title="info.server.cpuModel || ''">
                {{ info.server.cpuModel || '—' }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="系统负载">
              <span :class="loadClass">{{ info.server.load1 ?? '—' }}</span>
              <span class="tip">
                （1 分钟；
                5 分钟 {{ info.server.load5 ?? '—' }}，
                15 分钟 {{ info.server.load15 ?? '—' }}<template
                  v-if="info.server.loadPerCore !== null && info.server.loadPerCore !== undefined"
                >，每核 {{ info.server.loadPerCore }}</template>）
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="开机时长">
              {{ info.server.hostUptimeText || '—' }}
            </el-descriptions-item>
          </el-descriptions>
          <div class="meter">
            <div class="meter-head">
              <span>物理内存</span>
              <span>{{ formatSize(info.server.memUsedBytes) }} / {{ formatSize(info.server.memTotalBytes) }}</span>
            </div>
            <el-progress
              :percentage="info.server.memUsedPercent || 0"
              :color="pctColor(info.server.memUsedPercent)"
              :stroke-width="14"
            />
          </div>
          <div class="meter" v-if="info.server.swapTotalBytes">
            <div class="meter-head">
              <span>Swap</span>
              <span>{{ formatSize(info.server.swapUsedBytes) }} / {{ formatSize(info.server.swapTotalBytes) }}</span>
            </div>
            <el-progress
              :percentage="swapPercent"
              :color="pctColor(swapPercent, 50, 80)"
              :stroke-width="10"
            />
            <div class="tip">Swap 用得多说明物理内存紧张，会明显变慢</div>
          </div>
        </section>

        <!-- ==================== 应用（JVM） ==================== -->
        <section class="card">
          <div class="card-title"><el-icon><Cpu /></el-icon>应用（JVM）</div>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="Java">
              {{ info.jvm.javaVersion }}（{{ info.jvm.jvmName }} {{ info.jvm.javaVmVersion }}）
            </el-descriptions-item>
            <el-descriptions-item label="Java 家目录">
              <span class="ellipsis" :title="info.jvm.javaHome || ''">{{ info.jvm.javaHome || '—' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="进程 PID">{{ info.jvm.pid }}</el-descriptions-item>
            <el-descriptions-item label="启动时间">{{ info.jvm.startTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="已运行">{{ info.jvm.uptimeText || '—' }}</el-descriptions-item>
            <el-descriptions-item label="线程数">
              {{ info.jvm.threadCount }}
              <span class="tip">（峰值 {{ info.jvm.peakThreadCount }}，守护 {{ info.jvm.daemonThreadCount }}）</span>
            </el-descriptions-item>
            <el-descriptions-item label="类加载">
              {{ formatNumber(info.jvm.loadedClassCount) }} 已加载
              <span class="tip">（累计 {{ formatNumber(info.jvm.totalLoadedClassCount) }}，卸载 {{ formatNumber(info.jvm.unloadedClassCount) }}）</span>
            </el-descriptions-item>
            <el-descriptions-item label="GC 累计">
              {{ formatNumber(info.jvm.gcCount) }} 次 / {{ formatDuration(info.jvm.gcTimeMs) }}
              <span class="tip">（{{ gcDetail }}）</span>
            </el-descriptions-item>
            <el-descriptions-item label="时区 / 语言">
              {{ info.jvm.timezone || '—' }} / {{ info.jvm.locale || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="文件编码">{{ info.jvm.fileEncoding || '—' }}</el-descriptions-item>
            <el-descriptions-item label="工作目录">
              <span class="ellipsis" :title="info.jvm.workingDir || ''">{{ info.jvm.workingDir || '—' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="导出目录">{{ info.jvm.exportDir }}</el-descriptions-item>
            <el-descriptions-item label="上传临时目录">{{ info.jvm.tusTempDir }}</el-descriptions-item>
          </el-descriptions>
          <div class="meter">
            <div class="meter-head">
              <span>堆内存</span>
              <span>{{ formatSize(info.jvm.heapUsedBytes) }} / {{ formatSize(info.jvm.heapMaxBytes) }}</span>
            </div>
            <el-progress
              :percentage="info.jvm.heapUsedPercent || 0"
              :color="pctColor(info.jvm.heapUsedPercent)"
              :stroke-width="14"
            />
            <div class="tip">堆用满会触发 OOM，持续高于 85% 建议调大 -Xmx</div>
          </div>
          <div class="meter">
            <div class="meter-head">
              <span>非堆 + 元空间</span>
              <span>
                {{ formatSize(info.jvm.nonHeapUsedBytes) }}
                <template v-if="(info.jvm.metaspaceUsedBytes ?? -1) >= 0">
                  ／元空间 {{ formatSize(info.jvm.metaspaceUsedBytes) }}
                </template>
              </span>
            </div>
            <div class="tip">
              元空间不在堆里，堆很空但元空间满了同样会 OOM；持续增长要留意热部署/类加载泄漏
            </div>
          </div>
          <details class="args" v-if="info.jvm.jvmArgs?.length">
            <summary>启动参数（{{ info.jvm.jvmArgs.length }} 项）</summary>
            <div class="args-body">
              <div v-for="(a, i) in info.jvm.jvmArgs" :key="i" class="arg">{{ a }}</div>
            </div>
          </details>
        </section>

        <!-- ==================== 磁盘 ==================== -->
        <section class="card">
          <div class="card-title"><el-icon><FolderOpened /></el-icon>磁盘</div>
          <div v-for="d in info.disks" :key="d.path" class="disk">
            <div class="meter-head">
              <span>
                <b>{{ d.path }}</b>
                <span class="tip" v-if="d.store">（{{ d.store }}）</span>
              </span>
              <span>{{ formatSize(d.usedBytes) }} / {{ formatSize(d.totalBytes) }}</span>
            </div>
            <el-progress
              :percentage="d.usedPercent || 0"
              :color="pctColor(d.usedPercent, 85, 95)"
              :stroke-width="14"
            />
            <div class="tip">
              可用 {{ formatSize(d.usableBytes) }}
              <template v-if="d.error"> ，读取失败：{{ d.error }}</template>
            </div>
          </div>
          <el-table
            v-if="info.dmsDirs?.length"
            :data="info.dmsDirs"
            size="small"
            style="margin-top: 12px"
          >
            <el-table-column prop="path" label="DMS 目录" />
            <el-table-column label="占用" width="110">
              <template #default="{ row }">{{ formatSize(row.bytes) }}</template>
            </el-table-column>
          </el-table>
        </section>

        <!-- ==================== 数据库 ==================== -->
        <section class="card">
          <div class="card-title">
            <el-icon><Coin /></el-icon>数据库
            <el-tag v-if="info.database.ok === false" type="danger" size="small">连接异常</el-tag>
          </div>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="产品/版本">{{ info.database.version || '—' }}</el-descriptions-item>
            <el-descriptions-item label="库名">{{ info.database.database || '—' }}</el-descriptions-item>
            <el-descriptions-item label="库大小">{{ formatSize(info.database.sizeBytes) }}</el-descriptions-item>
            <el-descriptions-item label="表数据量">
              {{ formatSize(info.database.tablesBytes) }}（{{ info.database.tableCount }} 张表）
            </el-descriptions-item>
            <el-descriptions-item label="连接数">
              {{ info.database.connections }} / {{ info.database.maxConnections }}
            </el-descriptions-item>
            <el-descriptions-item label="启动时间">{{ info.database.startTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="已运行">{{ info.database.uptimeText || '—' }}</el-descriptions-item>
          </el-descriptions>
          <el-alert
            v-if="info.database.error"
            type="error"
            :closable="false"
            :title="String(info.database.error)"
            style="margin-top: 10px"
          />
        </section>

        <!-- ==================== MinIO ==================== -->
        <section class="card">
          <div class="card-title">
            <el-icon><Box /></el-icon>MinIO 对象存储
            <el-tag v-if="info.minio.ok === false" type="danger" size="small">不可达</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </div>
          <!-- 配置：应用实际在用的值（改配置后这里跟着变，不是写死的说明文本） -->
          <div class="sub-title">配置（实际生效值）</div>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="服务地址">
              {{ info.minio.config?.endpoint || info.minio.endpoint || '（未配置）' }}
            </el-descriptions-item>
            <el-descriptions-item label="存储桶">
              {{ info.minio.config?.bucket || info.minio.bucket }}
              <el-tag v-if="info.minio.bucketExists === false" type="danger" size="small">不存在</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="区域">{{ info.minio.config?.region || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Access Key">
              <code class="mono">{{ info.minio.config?.accessKey || '—' }}</code>
              <span class="tip">（已掩码）</span>
            </el-descriptions-item>
            <el-descriptions-item label="Secret Key">
              <el-tag :type="info.minio.config?.secretKeySet ? 'success' : 'danger'" size="small">
                {{ info.minio.config?.secretKeySet ? '已配置' : '未配置' }}
              </el-tag>
              <span class="tip">出于安全不在页面回传，只在服务器 /opt/dms/config/application-dev.yml 里</span>
            </el-descriptions-item>
            <el-descriptions-item label="数据目录">{{ info.minio.config?.dataDir || '—' }}</el-descriptions-item>
            <el-descriptions-item label="对象前缀">
              <code class="mono">{{ info.minio.config?.originalPrefix }}</code> 原件 ·
              <code class="mono">{{ info.minio.config?.previewPrefix }}</code> 预览 ·
              <code class="mono">{{ info.minio.config?.thumbnailPrefix }}</code> 缩略图
            </el-descriptions-item>
            <el-descriptions-item label="直链有效期">
              {{ info.minio.config?.mediaTokenTtlMinutes }} 分钟
              <span class="tip">（图片/视频带签名令牌的访问时限，过期需重新换取）</span>
            </el-descriptions-item>
            <el-descriptions-item label="单文件上限">
              {{ formatSize(info.minio.config?.maxUploadBytes) }}
            </el-descriptions-item>
            <el-descriptions-item label="控制台">
              <span class="tip">{{ info.minio.config?.consoleHint }}</span>
            </el-descriptions-item>
          </el-descriptions>

          <!-- 运行状态 -->
          <div class="sub-title">运行状态</div>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="可达性">
              <el-tag :type="info.minio.reachable ? 'success' : 'danger'" size="small">
                {{ info.minio.reachable ? '正常' : '不可达' }}
              </el-tag>
              <span class="tip">（探测耗时 {{ info.minio.latencyMs ?? '—' }} ms）</span>
            </el-descriptions-item>
            <el-descriptions-item label="桶是否存在">
              {{ info.minio.bucketExists === true ? '存在' : '不存在' }}
              <span v-if="info.minio.existsNoPermission" class="tip">（无权限查询）</span>
            </el-descriptions-item>
            <el-descriptions-item label="对象总数">
              {{ formatNumber(info.minio.objects) }}
              <el-tag v-if="info.minio.truncated" type="warning" size="small">已达统计上限</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="占用空间">{{ formatSize(info.minio.bytes) }}</el-descriptions-item>
          </el-descriptions>
          <el-table
            v-if="info.minio.prefixes?.length"
            :data="info.minio.prefixes"
            size="small"
            style="margin-top: 10px"
          >
            <el-table-column prop="prefix" label="目录" width="100" />
            <el-table-column label="对象数" width="100">
              <template #default="{ row }">{{ row.objects }}</template>
            </el-table-column>
            <el-table-column label="占用">
              <template #default="{ row }">{{ formatSize(row.bytes) }}</template>
            </el-table-column>
          </el-table>
          <el-alert
            v-if="info.minio.error"
            type="error"
            :closable="false"
            :title="String(info.minio.error)"
            style="margin-top: 10px"
          />
        </section>

        <!-- ==================== Redis ==================== -->
        <section class="card">
          <div class="card-title">
            <el-icon><DataLine /></el-icon>Redis 缓存
            <el-tag v-if="info.redis.ok === false" type="danger" size="small">不可达</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </div>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="版本">{{ info.redis.version || '—' }}</el-descriptions-item>
            <el-descriptions-item label="已运行">{{ info.redis.uptimeText || '—' }}</el-descriptions-item>
            <el-descriptions-item label="已用内存">
              {{ info.redis.usedMemoryText || formatSize(info.redis.usedMemoryBytes) }}
            </el-descriptions-item>
            <el-descriptions-item label="连接客户端">{{ info.redis.connectedClients ?? '—' }}</el-descriptions-item>
            <el-descriptions-item label="当前库 Key 数">{{ info.redis.dbSize ?? '—' }}</el-descriptions-item>
            <el-descriptions-item label="累计命令数">{{ formatNumber(info.redis.totalCommands) }}</el-descriptions-item>
            <el-descriptions-item label="命中 / 未命中">
              {{ formatNumber(info.redis.keyspaceHits) }} / {{ formatNumber(info.redis.keyspaceMisses) }}
            </el-descriptions-item>
          </el-descriptions>
          <el-alert
            v-if="info.redis.error"
            type="error"
            :closable="false"
            :title="String(info.redis.error)"
            style="margin-top: 10px"
          />
        </section>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Refresh, Monitor, Cpu, Coin, Box, DataLine, FolderOpened, Document } from '@element-plus/icons-vue'
import { getSystemInfo, type SystemInfo } from '@/api/system'
import { getCategory } from '@/types/doc'
import { notifyError } from '@/api/http'

const info = ref<SystemInfo | null>(null)
const loading = ref(false)
const loadError = ref('')
const auto = ref(true)
let timer: ReturnType<typeof setInterval> | undefined

/** 发行版 / 内核：非 Linux 上拿不到发行版名，就退回 Java 报的系统信息 */
const kernelText = computed(() => {
  const sv = info.value?.server
  if (!sv) return '—'
  const kernel = sv.kernelVersion || sv.osVersion || ''
  return kernel ? `内核 ${kernel}（${sv.osArch || sv.cpuArch || '—'}）` : '—'
})

/** Swap 使用率 */
const swapPercent = computed(() => {
  const sv = info.value?.server
  if (!sv?.swapTotalBytes) return 0
  return Math.round(((sv.swapUsedBytes || 0) / sv.swapTotalBytes) * 100)
})

/** 文件构成：后端给"扩展名 → 个数/字节"，归类复用前端同一份规则 */
const fileExtRows = computed(() => {
  const rows: Array<{ ext: string; cnt: number | string; bytes: number | string }> =
    info.value?.business?.fileExts || []
  return rows.map(r => ({
    ext: r.ext,
    cnt: Number(r.cnt),
    bytes: Number(r.bytes),
    label: `${r.ext} · ${getCategory(undefined, r.ext)}`
  }))
})

/** GC 明细，如 "G1 Young Generation 12 次 / G1 Old Generation 0 次" */
const gcDetail = computed(() => {
  const gc: Array<{ name: string; count: number; timeMs: number }> = info.value?.jvm?.gc || []
  if (!gc.length) return '—'
  return gc.map(g => `${g.name} ${g.count} 次`).join('，')
})

/** 负载相对核数：跑满核数就算高 */
const loadClass = computed(() => {
  const load = info.value?.server?.loadAverage
  const cores = info.value?.server?.cpuCores || 1
  if (load === null || load === undefined) return ''
  if (load >= cores) return 'danger-text'
  if (load >= cores * 0.7) return 'warn-text'
  return ''
})

async function load() {
  loading.value = true
  try {
    info.value = await getSystemInfo()
    loadError.value = ''
  } catch (e: any) {
    // 采集失败保留上一次的数据，只把错误显示出来（页面不至于变空）
    loadError.value = e?.msg || e?.message || '未知错误'
    notifyError(e, '获取系统信息失败')
  } finally {
    loading.value = false
  }
}

function onAutoChange(v: boolean) {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
  if (v) {
    // 10 秒一次：够看出趋势，又不会把后端和日志刷爆
    timer = setInterval(load, 10000)
  }
}

/**
 * 字节数格式化
 *
 * 必须显式 Number()：后端把 Long 统一按字符串序列化（雪花 ID 超 JS 安全整数，
 * 整个项目都是这个约定），所以 sum()/count() 这类值到前端可能是 "136904206" 这种字符串。
 * 靠隐式转换也能算，但类型是错的，`bytes === 0` 这种判断会直接失效。
 */
function formatSize(bytes?: number | string | null) {
  const n = Number(bytes)
  if (bytes === null || bytes === undefined || Number.isNaN(n) || n < 0) return '—'
  if (n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatNumber(n?: number | string | null) {
  const v = Number(n)
  if (n === null || n === undefined || Number.isNaN(v) || v < 0) return '—'
  return v.toLocaleString('zh-CN')
}

/** GC 累计耗时：几毫秒就别显示成 0.0 s 了 */
function formatDuration(ms?: number | null) {
  if (ms === null || ms === undefined || ms < 0) return '—'
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} 秒`
  const m = Math.floor(ms / 60_000)
  return `${m} 分 ${Math.round((ms % 60_000) / 1000)} 秒`
}

/** 使用率配色：默认 90% 黄 / 95% 红 */
function pctColor(pct?: number | null, warn = 90, danger = 95) {
  const v = pct || 0
  if (v >= danger) return '#f56c6c'
  if (v >= warn) return '#e6a23c'
  return '#67c23a'
}

onMounted(() => {
  load()
  onAutoChange(auto.value)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.sys-page {
  background: white;
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
  padding: 20px 20px 0;
  flex-wrap: wrap;

  h3 { margin: 0; font-size: 16px; }
  .hint { color: #909399; font-size: 12px; flex: 1; min-width: 200px; }
  .header-actions { margin-left: auto; display: flex; gap: 14px; align-items: center; }
}
.page-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px 20px 40px;
}
.sub-title {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  margin: 14px 0 8px;
  padding-left: 8px;
  border-left: 3px solid #409eff;
}
.card-title + .sub-title { margin-top: 0; }
.mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
.ellipsis { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
/* 启动参数可能十几项，折起来，需要时再展开 */
.args { margin-top: 12px; font-size: 12px; }
.args summary { cursor: pointer; color: #409eff; }
.args-body {
  margin-top: 6px;
  max-height: 160px;
  overflow: auto;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 8px 10px;
}
.arg { font-family: ui-monospace, Menlo, Consolas, monospace; word-break: break-all; line-height: 1.7; }
/* 业务卡片内部两栏：账号与权限 / 文件构成 */
.biz-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.stats { margin-bottom: 4px; }

/* 自适应列宽：宽屏三列、中屏两列、窄屏一列 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 14px 16px 16px;
  background: #fff;
  min-width: 0;
}
.card.wide {
  grid-column: 1 / -1;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}
.meter {
  margin-top: 12px;
}
.meter-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
  gap: 8px;
}
.disk + .disk {
  margin-top: 14px;
}
.tip {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
.danger-text { color: #f56c6c; font-weight: 600; }
.warn-text { color: #e6a23c; font-weight: 600; }
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.stat {
  flex: 1 1 110px;
  min-width: 110px;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 12px;
  text-align: center;

  .num { display: block; font-size: 22px; font-weight: 600; color: #409eff; }
  .lbl { display: block; font-size: 12px; color: #909399; margin-top: 4px; }
}
:deep(.el-descriptions__label) { width: 96px; }
</style>
