<template>
  <div class="sys-page">
    <div class="page-toolbar">
      <el-button type="primary" :icon="Plus" @click="openAdd">新增部门</el-button>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <el-table
      :data="rows"
      v-loading="loading"
      row-key="deptId"
      border
      default-expand-all
      :tree-props="{ children: 'children' }"
    >
      <el-table-column prop="deptName" label="部门名称" min-width="180" />
      <el-table-column prop="orderNum" label="排序" width="80" align="center" />
      <el-table-column prop="leader" label="负责人" width="120" />
      <el-table-column prop="phone" label="联系电话" width="140" />
      <el-table-column prop="email" label="邮箱" min-width="150" />
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">{{ row.status === '0' ? '正常' : '停用' }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="165">
        <template #default="{ row }">{{ row.createTime }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" :icon="Plus" @click="openAdd(row)">新增</el-button>
          <el-button size="small" link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
          <el-popconfirm title="确认删除该部门？" @confirm="removeDept(row)">
            <template #reference>
              <el-button size="small" link type="danger" :icon="Delete">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="480px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="上级部门">
          <el-tree-select
            v-model="form.parentId"
            :data="rows"
            node-key="deptId"
            :props="{ label: 'deptName', children: 'children' }"
            check-strictly
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="部门名称" required>
          <el-input v-model="form.deptName" />
        </el-form-item>
        <el-form-item label="显示排序" required>
          <el-input-number v-model="form.orderNum" :min="0" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="form.leader" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="0">正常</el-radio>
            <el-radio value="1">停用</el-radio>
          </el-radio-group>
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
import { listSysDepts, createSysDept, updateSysDept, deleteSysDept } from '@/api/system'

const loading = ref(false)
const rows = ref<any[]>([])

const dialog = reactive({ visible: false, mode: 'add' as 'add' | 'edit', title: '' })
const form = reactive<any>({})

async function load() {
  loading.value = true
  try {
    rows.value = await listSysDepts()
  } finally {
    loading.value = false
  }
}

function openAdd(parent?: any) {
  dialog.mode = 'add'
  dialog.title = '新增部门'
  Object.keys(form).forEach(k => delete form[k])
  form.parentId = parent ? parent.deptId : 0
  form.orderNum = 0
  form.status = '0'
  dialog.visible = true
}

function openEdit(row: any) {
  dialog.mode = 'edit'
  dialog.title = `编辑部门 - ${row.deptName}`
  Object.assign(form, row)
  dialog.visible = true
}

async function save() {
  try {
    if (dialog.mode === 'add') {
      await createSysDept(form)
      ElMessage.success('创建成功')
    } else {
      await updateSysDept(form)
      ElMessage.success('保存成功')
    }
    dialog.visible = false
    load()
  } catch { /* http 层提示 */ }
}

async function removeDept(row: any) {
  try {
    await deleteSysDept(row.deptId)
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
