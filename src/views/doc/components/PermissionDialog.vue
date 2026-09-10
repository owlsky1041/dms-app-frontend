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
        <el-form-item label="选择主体">
          <el-select
            v-model="form.subjectKeys"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :loading="subjectLoading"
            placeholder="可多选，支持搜索（用户 / 角色 / 部门）"
            style="width: 100%"
            @visible-change="onSelectVisible"
          >
            <el-option-group v-for="g in subjectGroups" :key="g.label" :label="g.label">
              <el-option
                v-for="o in g.options"
                :key="o.key"
                :label="o.label"
                :value="o.key"
              />
            </el-option-group>
          </el-select>
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
/** 分组多选选项：key 形如 "user:176..."，value 必须是字符串（雪花 ID 超 2^53，数字会精度丢失） */
const subjectGroups = ref<{ label: string; options: { key: string; label: string }[] }[]>([])
const subjectLoading = ref(false)
const selectedFlags = ref<number[]>([])

const form = reactive({
  subjectKeys: [] as string[],
  inheritToChildren: true,
  expiresAt: undefined as string | null | undefined
})

const canGrant = computed(() => form.subjectKeys.length > 0 && selectedFlags.value.length > 0)

/** 完全控制位：勾选后其余权限自动全选并锁定 */
const FULL_CONTROL = 128
const fullControlChecked = computed(() => selectedFlags.value.includes(FULL_CONTROL))

function onFlagsChange(val: any[]) {
  if (val.map(Number).includes(FULL_CONTROL)) {
    // 完全控制已包含全部权限，不允许出现「完全控制 + 部分权限」这种组合
    selectedFlags.value = permissionFlags.map(f => f.code)
  }
}

const labelMap = { user: '用户', role: '角色', dept: '部门' }
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
  form.subjectKeys = []
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
 * 加载可选主体（用户/角色/部门一次性分组载入，支持多选与搜索）
 * 注意：ID 一律保持字符串 —— 雪花 ID 19 位超出 JS 安全整数范围，Number() 会精度丢失
 */
async function loadSubjectGroups() {
  if (subjectGroups.value.length || subjectLoading.value) return
  subjectLoading.value = true
  try {
    const [usersRes, rolesRes, deptsRes] = await Promise.all([
      listUsers().catch(() => null),
      listRoles().catch(() => null),
      listDepts().catch(() => null)
    ])
    const users = (usersRes?.rows || []).map((u: any) => ({
      key: `user:${String(u.userId)}`,
      label: `${u.nickName || u.userName}${u.userName ? `(${u.userName})` : ''}`
    }))
    const roles = (rolesRes?.rows || []).map((r: any) => ({
      key: `role:${String(r.roleId)}`,
      label: r.roleName
    }))
    const depts = (deptsRes || []).map((d: any) => ({
      key: `dept:${String(d.deptId)}`,
      label: d.deptName
    }))
    subjectGroups.value = [
      { label: '用户', options: users },
      { label: '角色', options: roles },
      { label: '部门', options: depts }
    ].filter(g => g.options.length > 0)
  } catch (e) {
    subjectGroups.value = []
  } finally {
    subjectLoading.value = false
  }
}

function onSelectVisible(open: boolean) {
  if (open) loadSubjectGroups()
}

function flagsToMask(flags: number[]): number {
  return flags.reduce((acc, f) => acc | f, 0)
}

async function grant() {
  if (!form.subjectKeys.length) return
  const permFlags = flagsToMask(selectedFlags.value)
  // 后端接口一次只能授一个主体，多选时逐个提交
  let ok = 0
  let failed: string[] = []
  for (const key of form.subjectKeys) {
    const idx = key.indexOf(':')
    const subjectType = key.slice(0, idx)
    const subjectId = key.slice(idx + 1)   // 保持字符串，避免雪花 ID 精度丢失
    try {
      const payload = {
        subjectType,
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
      failed.push(subjectType)
    }
  }
  if (ok) ElMessage.success(`已授权 ${ok} 个主体`)
  if (failed.length) ElMessage.warning(`${failed.length} 个主体授权失败`)
  form.subjectKeys = []
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
