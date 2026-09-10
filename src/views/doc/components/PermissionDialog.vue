<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    width="560px"
    :close-on-click-modal="false"
    @update:model-value="(v) => $emit('update:visible', v)"
    @open="init"
  >
    <!-- 当前已有权限 -->
    <div class="perm-current" v-if="items.length">
      <div class="label">当前权限</div>
      <el-table :data="items" size="small">
        <el-table-column label="主体" min-width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="tagType(row.subjectType)">
              {{ subjectLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="权限" min-width="180">
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
        <el-table-column label="" width="80" align="right">
          <template #default="{ row }">
            <el-button size="small" type="danger" link @click="revoke(row)">撤销</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 添加授权 -->
    <div class="perm-grant">
      <div class="label">添加授权</div>
      <el-form label-width="80px" size="small">
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
        <el-form-item label="权限">
          <el-checkbox-group v-model="selectedFlags" @change="onFlagsChange">
            <el-checkbox
              v-for="f in permissionFlags"
              :key="f.code"
              :value="f.code"
              :label="f.code"
              :disabled="fullControlChecked && f.code !== FULL_CONTROL"
            >
              {{ f.description }}
            </el-checkbox>
          </el-checkbox-group>
          <div v-if="fullControlChecked" class="perm-hint">
            已选「完全控制」：其余权限自动全选并锁定（完全控制本身已包含它们）
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

    <template #footer>
      <el-button @click="$emit('update:visible', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listFolderPerms, listFilePerms, grantFolder, grantFile, revokeFolder, revokeFile,
  listUsers, listRoles, listDepts
} from '@/api/doc'
import { ensureNames, displaySubject } from '@/utils/subjectNames'

/** 8 种权限位定义（与后端 PermissionFlag 一致） */
const permissionFlags = [
  { code: 1, description: '可见' },
  { code: 2, description: '预览' },
  { code: 4, description: '编辑' },
  { code: 8, description: '下载' },
  { code: 16, description: '删除' },
  { code: 32, description: '上传' },
  { code: 64, description: '创建子项' },
  { code: 128, description: '完全控制' }
]

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

const items = ref<any[]>([])
/** 各类型的候选主体（key 形如 "user:176..."，value 必须字符串：雪花 ID 超 2^53，数字会精度丢失） */
const typeOptions = ref<Record<'user' | 'role' | 'dept', { key: string; label: string }[]>>({
  user: [], role: [], dept: []
})
const subjectLoading = ref(false)
const selectedFlags = ref<number[]>([])

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

const canGrant = computed(() => pendingSubjects.value.length > 0 && selectedFlags.value.length > 0)

/** 完全控制位：勾选后其余权限自动全选并锁定；取消勾选则清空其余权限 */
const FULL_CONTROL = 128
const fullControlChecked = computed(() => selectedFlags.value.includes(FULL_CONTROL))
/** 记录上一次是否处于「完全控制」状态，用于识别「取消勾选」这一动作 */
let wasFullControl = false

function onFlagsChange(val: any[]) {
  const nowFull = val.map(Number).includes(FULL_CONTROL)
  if (nowFull) {
    // 完全控制已包含全部权限，不允许出现「完全控制 + 部分权限」这种组合
    selectedFlags.value = permissionFlags.map(f => f.code)
  } else if (wasFullControl) {
    // 取消「完全控制」：连带清空其余权限（那些是自动带上的，不是用户逐项选的）
    selectedFlags.value = []
  }
  wasFullControl = nowFull
}
const tagType = (t: string) => ({ user: '', role: 'success', dept: 'warning' })[t as string] || ''

function subjectLabel(row: any) {
  // 用户显示真实姓名，角色/部门显示各自名称；取不到才退回「类型#ID」
  return displaySubject(row.subjectType, row.subjectId)
}

function flagsText(flags: number): string[] {
  // 完全控制已包含全部权限，只显示它本身，避免出现一长串冗余标签
  if ((flags & FULL_CONTROL) !== 0) return ['完全控制']
  return permissionFlags.filter(f => (flags & f.code) !== 0).map(f => f.description)
}

async function init() {
  selectedFlags.value = []
  wasFullControl = false
  form.selected.user = []
  form.selected.role = []
  form.selected.dept = []
  try {
    items.value = props.resourceType === 'folder'
      ? await listFolderPerms(props.resourceId)
      : await listFilePerms(props.resourceId)
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
    const [usersRes, rolesRes, deptsRes] = await Promise.all([
      listUsers().catch(() => null),
      listRoles().catch(() => null),
      listDepts().catch(() => null)
    ])
    typeOptions.value = {
      user: (usersRes?.rows || []).map((u: any) => ({
        key: `user:${String(u.userId)}`,
        label: `${u.nickName || u.userName}${u.userName ? `(${u.userName})` : ''}`
      })),
      role: (rolesRes?.rows || []).map((r: any) => ({
        key: `role:${String(r.roleId)}`,
        label: r.roleName
      })),
      dept: (deptsRes || []).map((d: any) => ({
        key: `dept:${String(d.deptId)}`,
        label: d.deptName
      }))
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

function flagsToMask(flags: number[]): number {
  return flags.reduce((acc, f) => acc | f, 0)
}

async function grant() {
  const targets = pendingSubjects.value
  if (!targets.length) return
  const permFlags = flagsToMask(selectedFlags.value)
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
        permFlags,
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
  selectedFlags.value = []
  wasFullControl = false
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
.perm-current {
  margin-bottom: 20px;

  .label {
    font-weight: 600;
    margin-bottom: 8px;
    color: #303133;
  }
}

.perm-grant {
  border-top: 1px dashed #dcdfe6;
  padding-top: 16px;

  .label {
    font-weight: 600;
    margin-bottom: 8px;
    color: #303133;
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

.grant-btn {
    text-align: right;
  }
}
</style>
