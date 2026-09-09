<template>
  <div class="sys-page">
    <div class="page-toolbar">
      <el-button type="primary" :icon="Plus" @click="openAdd">新增角色</el-button>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column prop="roleId" label="角色ID" width="90" />
      <el-table-column prop="roleName" label="角色名称" min-width="120" />
      <el-table-column prop="roleKey" label="权限字符" min-width="120">
        <template #default="{ row }"><el-tag>{{ row.roleKey }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="orderNum" label="排序" width="70" align="center" />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'">
            {{ row.status === '0' ? '正常' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      <el-table-column label="创建时间" width="165">
        <template #default="{ row }">{{ row.createTime }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
          <el-popconfirm title="确认删除该角色？" @confirm="removeRole(row)">
            <template #reference>
              <el-button size="small" link type="danger" :icon="Delete">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="480px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="角色名称" required>
          <el-input v-model="form.roleName" />
        </el-form-item>
        <el-form-item label="权限字符" required>
          <el-input v-model="form.roleKey" />
        </el-form-item>
        <el-form-item label="显示排序">
          <el-input-number v-model="form.orderNum" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="0">正常</el-radio>
            <el-radio value="1">停用</el-radio>
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
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Edit, Delete, Refresh } from '@element-plus/icons-vue'
import { listSysRoles, createSysRole, updateSysRole, deleteSysRole } from '@/api/system'

const loading = ref(false)
const rows = ref<any[]>([])
const dialog = reactive({ visible: false, mode: 'add' as 'add' | 'edit', title: '' })
const form = reactive<any>({})

async function load() {
  loading.value = true
  try {
    const res = await listSysRoles()
    rows.value = res.rows
  } finally {
    loading.value = false
  }
}

function openAdd() {
  dialog.mode = 'add'
  dialog.title = '新增角色'
  Object.keys(form).forEach(k => delete form[k])
  form.orderNum = 0
  form.status = '0'
  dialog.visible = true
}

function openEdit(row: any) {
  dialog.mode = 'edit'
  dialog.title = `编辑角色 - ${row.roleName}`
  Object.assign(form, row)
  dialog.visible = true
}

async function save() {
  try {
    if (dialog.mode === 'add') {
      await createSysRole(form)
    } else {
      await updateSysRole(form)
    }
    ElMessage.success('保存成功')
    dialog.visible = false
    load()
  } catch { /* http 层提示 */ }
}

async function removeRole(row: any) {
  try {
    await deleteSysRole(row.roleId)
    ElMessage.success('已删除')
    load()
  } catch { /* http 层提示 */ }
}

onMounted(load)
</script>

<style scoped>
.sys-page {
  background: white;
  padding: 20px;
  border-radius: 8px;
  height: calc(100vh - 110px);
  overflow: auto;
}
.page-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
