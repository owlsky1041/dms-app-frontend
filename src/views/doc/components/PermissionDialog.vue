<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    class="perm-dialog"
    width="min(1120px, 94vw)"
    top="5vh"
    :close-on-click-modal="false"
    @update:model-value="(v) => $emit('update:visible', v)"
    @open="init"
  >
    <!--
      两栏布局：左栏「看」（本层授权 + 继承来的授权），右栏「改」（添加授权表单）。
      原来单栏从上往下堆，弹窗又窄又高，档位说明一换行就更长，一屏放不下。
    -->
    <div class="perm-layout">
      <!-- ==================== 左栏：现有授权 ==================== -->
      <div class="perm-col">
        <div class="perm-current">
          <div class="label">
            本层权限
            <span class="label-hint">
              直接授予在当前{{ typeText }}上的授权，可在此撤销
            </span>
          </div>
          <el-table
            v-if="directItems.length"
            :data="directItems"
            size="small"
            max-height="260"
          >
            <el-table-column label="主体" min-width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="tagType(row.subjectType)">
                  {{ subjectLabel(row) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="权限" min-width="170">
              <template #default="{ row }">
                <el-tag
                  v-for="(f, i) in flagsText(row.permFlags)"
                  :key="i"
                  size="small"
                  type="info"
                  style="margin: 1px"
                >{{ f }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="" width="72" align="right">
              <template #default="{ row }">
                <el-button size="small" type="danger" link @click="revoke(row)">撤销</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else :image-size="44" description="本层没有单独授权" />
        </div>

        <!-- 继承自上级的权限（只读，需去来源处修改） -->
        <div class="perm-current perm-inherited">
          <div class="label">
            继承权限
            <span class="label-hint">
              来自上级目录，对当前{{ typeText }}同样生效；要修改请到来源目录上操作
            </span>
          </div>
          <el-table
            v-if="inheritedItems.length"
            :data="inheritedItems"
            size="small"
            max-height="260"
          >
            <el-table-column label="来源" min-width="120">
              <template #default="{ row }">
                <el-tag size="small" type="warning">{{ row.sourceFolderName || '上级目录' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="主体" min-width="96">
              <template #default="{ row }">
                <el-tag size="small" :type="tagType(row.subjectType)">
                  {{ subjectLabel(row) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="权限" min-width="150">
              <template #default="{ row }">
                <el-tag
                  v-for="(f, i) in flagsText(row.permFlags)"
                  :key="i"
                  size="small"
                  type="info"
                  style="margin: 1px"
                >{{ f }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else :image-size="44" description="没有继承到任何授权" />
        </div>
      </div>

      <!-- ==================== 右栏：添加授权 ==================== -->
      <div class="perm-col perm-col-grant">
        <div class="perm-grant">
          <div class="label">添加授权</div>
          <el-form label-width="76px" size="small">
            <el-form-item label="主体类型">
              <el-radio-group v-model="form.subjectType" @change="onTypeChange">
                <el-radio-button value="user">用户{{ selectedCountByType.user ? ` (${selectedCountByType.user})` : '' }}</el-radio-button>
                <el-radio-button value="role">角色{{ selectedCountByType.role ? ` (${selectedCountByType.role})` : '' }}</el-radio-button>
                <el-radio-button value="dept">部门{{ selectedCountByType.dept ? ` (${selectedCountByType.dept})` : '' }}</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="选择主体">
              <!-- 多选：同一类型下可勾选多个；三种类型各自记住自己的选择 -->
              <el-select
                v-model="currentSelection"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                :loading="subjectLoading"
                :placeholder="`可多选，支持搜索（${labelMap[form.subjectType]}）`"
                style="width: 100%"
                @visible-change="onSelectVisible"
              >
                <el-option
                  v-for="o in currentOptions"
                  :key="o.key"
                  :label="o.label"
                  :value="o.key"
                />
              </el-select>
              <div v-if="totalSelected > 0" class="perm-hint selected-hint">
                已选 {{ totalSelected }} 个主体<span v-if="selectedTypeSummary">（{{ selectedTypeSummary }}）</span>，点「授权」将一并授权
              </div>
            </el-form-item>

            <el-form-item label="权限档位">
              <el-radio-group v-model="levelKey" class="level-group">
                <el-radio v-for="l in PERM_LEVELS" :key="l.key" :value="l.key" class="level-radio">
                  <span class="level-label" :class="l.key">{{ l.label }}</span>
                  <span class="level-desc">{{ l.desc }}</span>
                </el-radio>
              </el-radio-group>
              <div v-if="levelKey === 'deny'" class="perm-hint deny-hint">
                已选「禁止访问」：该主体<b>完全看不到</b>此{{ typeText }}
                （列表与搜索中均不出现），且对其下子项一并生效；优先级高于任何授权
              </div>
            </el-form-item>

            <el-form-item label="下载">
              <el-switch
                v-model="downloadEnabled"
                :disabled="!downloadSelectable"
                active-text="允许下载原件"
              />
              <div class="perm-hint">
                <template v-if="levelKey === 'deny'">禁止访问时下载无意义，已锁定关闭。</template>
                <template v-else-if="levelKey === 'full'">「完全控制」已包含下载，无需单独设置。</template>
                <template v-else>
                  下载是独立开关，可叠加在只读/读写之上；关闭时只能在线预览，原件带不走。
                </template>
              </div>
            </el-form-item>

            <el-form-item v-if="resourceType === 'folder'" label="继承">
              <el-switch v-model="form.inheritToChildren" active-text="应用到子文件夹和文件" />
            </el-form-item>

            <el-form-item label="过期时间">
              <el-date-picker
                v-model="form.expiresAt"
                type="datetime"
                placeholder="留空=永久"
                style="width: 100%"
              />
            </el-form-item>
          </el-form>

          <div class="grant-btn">
            <el-button type="primary" :disabled="!canGrant" @click="grant">授权</el-button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listFolderEffectivePerms, listFileEffectivePerms,
  grantFolder, grantFile, revokeFolder, revokeFile,
  getSubjects
} from '@/api/doc'
import { ensureNames, displaySubject } from '@/utils/subjectNames'
import {
  PERM_LEVELS, PERM_DENY, PERM_DOWNLOAD, describePerm
} from '@/types/doc'

/** 8 种权限位定义（与后端 PermissionFlag 一致） */
/**
 * 权限位（与后端 PermissionFlag 一致）
 * 「编辑」「创建子项」已取消：重命名/移动改由完全控制判定，新建子目录归入上传
 * 「禁止访问」为拒绝位：命中即完全不可见并向下继承，与其它位互斥
 */
/**
 * 权限档位与「下载」开关
 *
 * 对用户只暴露 4 个档位 + 1 个开关，具体位掩码由 PERM_LEVELS 提供；
 * 档位是嵌套的（只读 ⊂ 读写 ⊂ 完全控制），因此「禁止 > 读写 > 只读」的优先级
 * 天然成立，不需要前端做优先级比较。
 */
const DENY = PERM_DENY
/** 当前选中的档位 key */
const levelKey = ref<string>('readonly')
/** 「下载」开关（完全控制/禁止访问时不可用） */
const downloadEnabled = ref(false)

/** 只有只读/读写档可以单独叠加下载 */
const downloadSelectable = computed(() => levelKey.value === 'readonly' || levelKey.value === 'readwrite')

/** 档位或下载开关变化时，同步一遍下载开关的可用状态 */
watch([levelKey, downloadSelectable], () => {
  if (levelKey.value === 'deny') downloadEnabled.value = false
  if (levelKey.value === 'full') downloadEnabled.value = true
}, { immediate: true })

/** 最终提交的位掩码 */
const permFlags = computed(() => {
  const def = PERM_LEVELS.find(l => l.key === levelKey.value) || PERM_LEVELS[0]
  if (def.key === 'deny') return DENY
  return def.flags | (downloadEnabled.value ? PERM_DOWNLOAD : 0)
})

const props = defineProps<{
  visible: boolean
  resourceType: 'folder' | 'file'
  resourceId: number
  resourceName?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'changed'): void
}>()

const dialogTitle = computed(() => {
  const type = props.resourceType === 'folder' ? '文件夹' : '文件'
  return `${type}权限 - ${props.resourceName || props.resourceId}`
})

/** 「文件夹」/「文件」，模板里反复用到 */
const typeText = computed(() => (props.resourceType === 'folder' ? '文件夹' : '文件'))

const items = ref<any[]>([])
/** 本层授权（sourceType=direct，可撤销） */
const directItems = computed(() => items.value.filter((r: any) => r.sourceType !== 'inherited'))
/** 继承自上级目录的授权（只读） */
const inheritedItems = computed(() => items.value.filter((r: any) => r.sourceType === 'inherited'))
/** 各类型的候选主体（key 形如 "user:176..."，value 必须字符串：雪花 ID 超 2^53，数字会精度丢失） */
const typeOptions = ref<Record<'user' | 'role' | 'dept', { key: string; label: string }[]>>({
  user: [], role: [], dept: []
})
const subjectLoading = ref(false)

const form = reactive({
  subjectType: 'user' as 'user' | 'role' | 'dept',
  /** 每种类型各记一份选择：切换选项卡不会丢掉已选 */
  selected: {
    user: [] as string[],
    role: [] as string[],
    dept: [] as string[]
  },
  inheritToChildren: true,
  expiresAt: undefined as string | null | undefined
})

const labelMap = { user: '用户', role: '角色', dept: '部门' }

/** 当前选项卡下已选中的主体（与下拉框双向绑定） */
const currentSelection = computed({
  get: () => form.selected[form.subjectType],
  set: (v: string[]) => { form.selected[form.subjectType] = v || [] }
})

const currentOptions = computed(() => typeOptions.value[form.subjectType])

/** 已选主体总数（跨三种类型） */
const totalSelected = computed(() =>
  form.selected.user.length + form.selected.role.length + form.selected.dept.length)

const selectedCountByType = computed(() => ({
  user: form.selected.user.length,
  role: form.selected.role.length,
  dept: form.selected.dept.length
}))

const selectedTypeSummary = computed(() =>
  (['user', 'role', 'dept'] as const)
    .filter(t => form.selected[t].length > 0)
    .map(t => `${labelMap[t]} ${form.selected[t].length} 个`)
    .join('、'))

/** 待授权的主体清单：type:id */
const pendingSubjects = computed(() =>
  (['user', 'role', 'dept'] as const).flatMap(t => form.selected[t].map(k => ({ type: t, key: k }))))

const canGrant = computed(() => pendingSubjects.value.length > 0 && permFlags.value !== 0)

const tagType = (t: string) => ({ user: '', role: 'success', dept: 'warning' })[t as string] || ''

function subjectLabel(row: any) {
  // 用户显示真实姓名，角色/部门显示各自名称；取不到才退回「类型#ID」
  return displaySubject(row.subjectType, row.subjectId)
}

/**
 * 掩码 → 展示标签
 *
 * 统一走 types/doc.ts 的 describePerm：它按「包含关系」宽容反推档位，
 * 因此历史数据（如只有「可见」位、或只有 128 没有编辑位）也能显示成可读文字。
 */
function flagsText(flags: number): string[] {
  return describePerm(flags)
}

async function init() {
  // 每次打开重置为默认档位（只读、不含下载）
  levelKey.value = 'readonly'
  downloadEnabled.value = false
  form.selected.user = []
  form.selected.role = []
  form.selected.dept = []
  try {
    // 用 effective 接口：同时拿到本层授权与继承自上级的授权。
    // 只查本层时，授权建在文档区的情况下弹窗会显示为空，看起来像"没有权限"。
    items.value = props.resourceType === 'folder'
      ? await listFolderEffectivePerms(props.resourceId)
      : await listFileEffectivePerms(props.resourceId)
    // 已授权清单里的主体：批量解析名称，界面显示真实姓名
    const byType = (t: string) => items.value.filter((r: any) => r.subjectType === t).map((r: any) => r.subjectId)
    ensureNames('user', byType('user'))
    ensureNames('role', byType('role'))
    ensureNames('dept', byType('dept'))
  } catch (e) {
    items.value = []
  }
}

/**
 * 加载可选主体（用户/角色/部门一次性载入，各类型分开存放）
 * 注意：ID 一律保持字符串 —— 雪花 ID 19 位超出 JS 安全整数范围，Number() 会精度丢失
 */
async function loadSubjectOptions() {
  if (subjectLoading.value) return
  if (typeOptions.value.user.length || typeOptions.value.role.length || typeOptions.value.dept.length) return
  subjectLoading.value = true
  try {
    const subjects = await getSubjects()
    typeOptions.value = {
      user: subjects.users.map(o => ({ key: `user:${o.id}`, label: o.label })),
      role: subjects.roles.map(o => ({ key: `role:${o.id}`, label: o.label })),
      dept: subjects.depts.map(o => ({ key: `dept:${o.id}`, label: o.label }))
    }
  } catch (e) {
    typeOptions.value = { user: [], role: [], dept: [] }
  } finally {
    subjectLoading.value = false
  }
}

/** 切换选项卡：各类型选择各自保留，无需重新加载 */
function onTypeChange() {
  loadSubjectOptions()
}

function onSelectVisible(open: boolean) {
  if (open) loadSubjectOptions()
}

async function grant() {
  const targets = pendingSubjects.value
  if (!targets.length) return
  const mask = permFlags.value
  // 后端接口一次只能授一个主体，多选时逐个提交
  let ok = 0
  const failed: string[] = []
  for (const t of targets) {
    const idx = t.key.indexOf(':')
    const subjectId = t.key.slice(idx + 1)   // 保持字符串，避免雪花 ID 精度丢失
    try {
      const payload = {
        subjectType: t.type,
        subjectId,
        permFlags: mask,
        inheritToChildren: form.inheritToChildren,
        expiresAt: form.expiresAt || null
      }
      if (props.resourceType === 'folder') {
        await grantFolder(props.resourceId, payload as any)
      } else {
        await grantFile(props.resourceId, payload as any)
      }
      ok++
    } catch (e) {
      failed.push(`${labelMap[t.type]}授权失败`)
    }
  }
  if (ok) ElMessage.success(`已授权 ${ok} 个主体`)
  if (failed.length) ElMessage.warning(failed.join('、'))
  // 清空选择（含三种类型）
  form.selected.user = []
  form.selected.role = []
  form.selected.dept = []
  await init()
}

async function revoke(row: any) {
  if (props.resourceType === 'folder') {
    await revokeFolder(props.resourceId, row.subjectType, row.subjectId)
  } else {
    await revokeFile(props.resourceId, row.subjectType, row.subjectId)
  }
  ElMessage.success('已撤销')
  emit('changed')
  init()
}
</script>

<style lang="scss" scoped>
/*
 * 弹窗本体：宽度由 width="min(1120px, 94vw)" 控制。
 * 内容区限高 + 内部滚动，免得矮屏幕上档位说明被截掉还看不到滚动条。
 *
 * 这一段必须用 :global()，不能靠 scoped：
 *   - 只写 :deep(.el-dialog__body) → 编译成 [data-v-x] .el-dialog__body，祖先没有 data-v，匹配不到；
 *   - 写 .perm-dialog :deep(...)   → 编译成 .perm-dialog[data-v-x] ...，而 .perm-dialog 就是
 *     el-dialog 的根元素，它自己不带头 data-v-x（el-dialog 模板根是 <teleport>，
 *     Vue 不会给 teleport 出去的内容加 scope 属性），同样匹配不到。
 * 两种写法都是"看着改对了、限高其实没生效"，窄屏下弹窗会一路长到 792px 才发现。
 * 只按类名限定，作用域照样只有这个弹窗。
 */
:global(.perm-dialog .el-dialog__body) {
  max-height: 74vh;
  overflow-y: auto;
  padding-top: 12px;
}

/* ==================== 两栏骨架 ==================== */
.perm-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
}

.perm-col {
  min-width: 0;      /* 不写会让内部的 el-table 撑破网格 */
}

/* 两栏之间一条竖线，视觉上分开「看」和「改」 */
.perm-col-grant {
  border-left: 1px solid #ebeef5;
  padding-left: 22px;
}

/* 窄屏（笔记本半屏、小投影）退回单栏，别硬挤成两列都看不清 */
@media (max-width: 1000px) {
  .perm-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .perm-col-grant {
    border-left: none;
    padding-left: 0;
    border-top: 1px dashed #dcdfe6;
    padding-top: 16px;
  }
}

/* ==================== 左栏 ==================== */
.perm-current {
  margin-bottom: 16px;

  .label {
    font-weight: 600;
    margin-bottom: 8px;
    color: #303133;
  }

  .label-hint {
    font-weight: 400;
    color: #909399;
    font-size: 12px;
    margin-left: 8px;
  }
}

/* 继承权限：用淡背景与「本层权限」区分开，强调只读 */
.perm-inherited {
  background: #fdfaf5;
  border: 1px dashed #f0d9b5;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 0;
}

.perm-inherited :deep(.el-empty) {
  padding: 8px 0;
}

/* ==================== 右栏 ==================== */
.perm-grant {
  .label {
    font-weight: 600;
    margin-bottom: 12px;
    color: #303133;
  }

  .deny-hint {
    color: #f56c6c;
  }

  .selected-hint {
    color: #409eff;
  }

  .perm-hint {
    margin-top: 4px;
    font-size: 12px;
    color: #e6a23c;
    line-height: 1.5;
  }

  /* 权限档位：一行一档，带一句话说明，比一行 4 个复选框好读得多 */
  .level-group {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }

  .level-radio {
    height: auto;
    margin-right: 0 !important;
    padding: 6px 0;
    align-items: flex-start;

    :deep(.el-radio__label) {
      display: flex;
      flex-direction: column;
      gap: 2px;
      white-space: normal;
      line-height: 1.5;
    }
  }

  .level-label {
    font-weight: 600;

    &.deny { color: #f56c6c; }
    &.full { color: #e6a23c; }
    &.readwrite { color: #409eff; }
  }

  .level-desc {
    color: #909399;
    font-size: 12px;
  }

  .grant-btn {
    text-align: right;
    margin-top: 4px;
  }
}
</style>
