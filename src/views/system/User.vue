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
      <el-table-column label="昵称" prop="nickName" min-width="100" />
      <el-table-column label="部门" prop="deptName" min-width="110" />
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
        <el-form-item label="昵称" required>
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
  resetUserPwd, changeUserStatus, listSysDepts
} from '@/api/system'

const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
const deptTree = ref<any[]>([])

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

function openAdd() {
  dialog.mode = 'add'
  dialog.title = '新增用户'
  Object.keys(form).forEach(k => delete form[k])
  form.status = '0'
  dialog.visible = true
}

function openEdit(row: any) {
  dialog.mode = 'edit'
  dialog.title = `编辑用户 - ${row.userName}`
  Object.assign(form, row)
  dialog.visible = true
}

async function save() {
  try {
    if (dialog.mode === 'add') {
      await createSysUser(form)
      ElMessage.success('创建成功')
    } else {
      await updateSysUser(form)
      ElMessage.success('保存成功')
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

onMounted(() => { load(); loadDeptTree() })
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
