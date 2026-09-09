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
              {{ row.subjectName || subjectLabel(row) }}
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
          <el-radio-group v-model="form.subjectType">
            <el-radio-button value="user">用户</el-radio-button>
            <el-radio-button value="role">角色</el-radio-button>
            <el-radio-button value="dept">部门</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="选择主体">
          <el-select
            v-model="form.subjectId"
            filterable
            placeholder="输入搜索"
            style="width: 100%"
            @focus="loadSubjects"
          >
            <el-option
              v-for="s in subjectOptions"
              :key="s.id"
              :label="s.label"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="权限">
          <el-checkbox-group v-model="selectedFlags">
            <el-checkbox v-for="f in permissionFlags" :key="f.code" :value="f.code" :label="f.code">
              {{ f.description }}
            </el-checkbox>
          </el-checkbox-group>
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
const subjectOptions = ref<{ id: number; label: string }[]>([])
const selectedFlags = ref<number[]>([])

const form = reactive({
  subjectType: 'user' as 'user' | 'role' | 'dept',
  subjectId: undefined as number | undefined,
  inheritToChildren: true,
  expiresAt: undefined as string | null | undefined
})

const canGrant = computed(() => !!form.subjectId && selectedFlags.value.length > 0)

const labelMap = { user: '用户', role: '角色', dept: '部门' }
const tagType = (t: string) => ({ user: '', role: 'success', dept: 'warning' })[t as string] || ''

function subjectLabel(row: any) {
  const name = (labelMap as any)[row.subjectType] || row.subjectType
  return `${name}#${row.subjectId}`
}

function flagsText(flags: number): string[] {
  return permissionFlags.filter(f => (flags & f.code) !== 0).map(f => f.description)
}

async function init() {
  selectedFlags.value = []
  form.subjectId = undefined
  try {
    items.value = props.resourceType === 'folder'
      ? await listFolderPerms(props.resourceId)
      : await listFilePerms(props.resourceId)
  } catch (e) {
    items.value = []
  }
}

async function loadSubjects() {
  try {
    if (form.subjectType === 'user') {
      const res: any = await listUsers()
      const rows = res?.rows || []
      subjectOptions.value = rows.map((u: any) => ({ id: Number(u.userId), label: `${u.nickName}(${u.userName})` }))
    } else if (form.subjectType === 'role') {
      const res: any = await listRoles()
      const rows = res?.rows || []
      subjectOptions.value = rows.map((r: any) => ({ id: Number(r.roleId), label: r.roleName }))
    } else {
      const res: any = await listDepts()
      subjectOptions.value = (res || []).map((d: any) => ({ id: Number(d.deptId), label: d.deptName }))
    }
  } catch (e) {
    subjectOptions.value = []
  }
}

watch(() => form.subjectType, () => { form.subjectId = undefined; subjectOptions.value = []; loadSubjects() })

function flagsToMask(flags: number[]): number {
  return flags.reduce((acc, f) => acc | f, 0)
}

async function grant() {
  if (!form.subjectId) return
  const payload = {
    subjectType: form.subjectType,
    subjectId: form.subjectId,
    permFlags: flagsToMask(selectedFlags.value),
    inheritToChildren: form.inheritToChildren,
    expiresAt: form.expiresAt || null
  }
  if (props.resourceType === 'folder') {
    await grantFolder(props.resourceId, payload)
  } else {
    await grantFile(props.resourceId, payload)
  }
  ElMessage.success('授权成功')
  form.subjectId = undefined
  selectedFlags.value = []
  emit('changed')
  init()
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

  .grant-btn {
    text-align: right;
  }
}
</style>
