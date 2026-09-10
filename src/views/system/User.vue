<template>
  <div class="sys-page">
    <div class="page-toolbar">
      <el-form inline size="default">
        <el-form-item label="用户名">
          <el-input v-model="query.userName" placeholder="搜索用户名" clearable style="width: 160px" @keyup.enter="load" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 100px">
            <el-option label="正常" value="0" />
            <el-option label="停用" value="1" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="load">搜索</el-button>
          <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
      <div class="right">
        <el-button type="primary" :icon="Plus" @click="openAdd">新增用户</el-button>
      </div>
    </div>

    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column label="用户ID" prop="userId" width="90" />
      <el-table-column label="用户名" prop="userName" min-width="100" />
      <el-table-column label="真实姓名" prop="nickName" min-width="100" />
      <el-table-column label="部门" prop="deptName" min-width="110" />
      <el-table-column label="角色" min-width="150">
        <template #default="{ row }">
          <template v-if="row._roleNames && row._roleNames.length">
            <el-tag
              v-for="n in row._roleNames"
              :key="n"
              size="small"
              style="margin-right: 4px"
            >{{ n }}</el-tag>
          </template>
          <template v-else-if="row.roles && row.roles.length">
            <el-tag
              v-for="r in row.roles"
              :key="r.roleId"
              size="small"
              style="margin-right: 4px"
            >{{ r.roleName }}</el-tag>
          </template>
          <span v-else style="color:#c0c4cc">未分配</span>
        </template>
      </el-table-column>
      <el-table-column label="手机" prop="phoneNumber" width="120" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === '0'"
            @change="(v: boolean) => toggleStatus(row, v)"
          />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="165">
        <template #default="{ row }">{{ row.createTime }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" link type="warning" :icon="Key" @click="openResetPwd(row)">重置密码</el-button>
          <el-popconfirm title="确认删除该用户？" @confirm="removeUser(row)">
            <template #reference>
              <el-button size="small" link type="danger" :icon="Delete">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="query.pageNum"
      v-model:page-size="query.pageSize"
      :total="total"
      layout="total, sizes, prev, pager, next"
      :page-sizes="[10, 20, 50]"
      style="margin-top: 12px; justify-content: flex-end"
      @current-change="load"
      @size-change="load"
    />

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialog.visible" :title="dialog.title" width="520px">
      <el-form ref="formRef" :model="form" label-width="90px">
        <el-form-item label="用户名" required>
          <el-input v-model="form.userName" :disabled="dialog.mode === 'edit'" />
        </el-form-item>
        <el-form-item v-if="dialog.mode === 'add'" label="密码" required>
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="真实姓名" required>
          <el-input v-model="form.nickName" />
        </el-form-item>
        <el-form-item label="手机">
          <el-input v-model="form.phoneNumber" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="部门">
          <el-tree-select
            v-model="form.deptId"
            :data="deptTree"
            :props="{ label: 'deptName', value: 'deptId', children: 'children' }"
            check-strictly
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="角色">
          <el-select
            v-model="form.roleIds"
            multiple
            placeholder="选择角色"
            style="width: 100%"
          >
            <el-option
              v-for="r in roleOptions"
              :key="r.roleId"
              :label="r.roleName"
              :value="r.roleId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio value="1">男</el-radio>
            <el-radio value="2">女</el-radio>
            <el-radio value="0">未知</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="pwdDialog.visible" title="重置密码" width="380px">
      <el-form label-width="80px">
        <el-form-item label="新密码">
          <el-input v-model="pwdDialog.password" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="savePwd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Plus, Edit, Delete, Key } from '@element-plus/icons-vue'
import {
  listSysUsers, createSysUser, updateSysUser, deleteSysUser,
  resetUserPwd, changeUserStatus, listSysDepts, listSysRoles,
  getUserAuthRole, saveUserAuthRole
} from '@/api/system'

const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
const deptTree = ref<any[]>([])
const roleOptions = ref<any[]>([])

const query = reactive({ userName: '', status: '', pageNum: 1, pageSize: 20 })

const dialog = reactive({ visible: false, mode: 'add' as 'add' | 'edit', title: '' })
const form = reactive<any>({})

const pwdDialog = reactive({ visible: false, userId: 0, userName: '', password: '' })

async function load() {
  loading.value = true
  try {
    const res = await listSysUsers(query)
    rows.value = res.rows
    total.value = res.total
    // 列表接口不返回角色，逐行补齐（最多 pageSize 条，并行请求）
    await Promise.all(rows.value.map(async (row: any) => {
      try {
        const info: any = await getUserAuthRole(row.userId)
        const list = info?.roles || []
        row._roleNames = list.map((r: any) => r.roleName)
      } catch { row._roleNames = [] }
    }))
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.userName = ''
  query.status = ''
  load()
}

async function loadDeptTree() {
  try {
    deptTree.value = await listSysDepts()
  } catch { deptTree.value = [] }
}

async function loadRoleOptions() {
  try {
    const res = await listSysRoles({ pageSize: 200 })
    roleOptions.value = res.rows || []
  } catch { roleOptions.value = [] }
}

function openAdd() {
  dialog.mode = 'add'
  dialog.title = '新增用户'
  Object.keys(form).forEach(k => delete form[k])
  form.status = '0'
  form.roleIds = []
  form.gender = '1'
  dialog.visible = true
}

async function openEdit(row: any) {
  dialog.mode = 'edit'
  dialog.title = `编辑用户 - ${row.userName}`
  Object.keys(form).forEach(k => delete form[k])
  Object.assign(form, row)
  form.roleIds = (row.roles || []).map((r: any) => r.roleId)
  dialog.visible = true
  // 回显已分配角色（权威数据，后端 roleIds 可能为 null，需从 roles 派生）
  try {
    const info = await getUserAuthRole(row.userId)
    if (info?.roleIds?.length) form.roleIds = info.roleIds.map((x: any) => String(x))
    else if (info?.roles?.length) form.roleIds = info.roles.map((r: any) => String(r.roleId))
  } catch { /* 忽略，用列表中的 roles */ }
}

async function save() {
  try {
    const payload = { ...form }
    const roleIds = payload.roleIds || []
    delete payload.roles
    delete payload.roleIds
    if (dialog.mode === 'add') {
      await createSysUser(payload)
      ElMessage.success('创建成功')
    } else {
      await updateSysUser(payload)
      ElMessage.success('保存成功')
    }
    // 同步角色关联（新增时后端不回传 userId，按用户名回查）
    try {
      let uid = payload.userId || form.userId
      if (!uid && dialog.mode === 'add' && payload.userName) {
        const res: any = await listSysUsers({ userName: payload.userName, pageNum: 1, pageSize: 1 })
        uid = res?.rows?.[0]?.userId
      }
      if (uid && roleIds.length) await saveUserAuthRole(uid, roleIds)
    } catch (e) {
      console.warn('角色关联保存失败', e)
    }
    dialog.visible = false
    load()
  } catch { /* http 层提示 */ }
}

async function removeUser(row: any) {
  try {
    await deleteSysUser(row.userId)
    ElMessage.success('已删除')
    load()
  } catch { /* http 层提示 */ }
}

async function toggleStatus(row: any, on: boolean) {
  try {
    await changeUserStatus(row.userId, on ? '0' : '1')
    row.status = on ? '0' : '1'
    ElMessage.success('状态已更新')
  } catch { /* http 层提示 */ }
}

function openResetPwd(row: any) {
  pwdDialog.userId = row.userId
  pwdDialog.userName = row.userName
  pwdDialog.password = ''
  pwdDialog.visible = true
}

async function savePwd() {
  try {
    await resetUserPwd(pwdDialog.userId, pwdDialog.password || '123456')
    ElMessage.success('密码已重置')
    pwdDialog.visible = false
  } catch { /* http 层提示 */ }
}

onMounted(() => { load(); loadDeptTree(); loadRoleOptions() })
</script>

<style scoped>
.sys-page {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin: 0;
  height: calc(100vh - 110px);
  overflow: auto;
}

.page-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
</style>
