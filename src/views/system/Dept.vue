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
      <el-table-column label="负责人" width="120">
        <template #default="{ row }">
          <!-- 后端 leader 存的是用户 ID，这里显示真实姓名 -->
          {{ displayUserName(row.leader) }}
        </template>
      </el-table-column>
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
          <!-- leader 必须是用户 ID（雪花 ID 用字符串传递，避免精度丢失） -->
          <el-select
            v-model="form.leader"
            filterable
            clearable
            :loading="userLoading"
            placeholder="从现有用户中选取"
            style="width: 100%"
            @change="onLeaderChange"
          >
            <el-option
              v-for="u in userOptions"
              :key="u.id"
              :label="u.label"
              :value="u.id"
            />
          </el-select>
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
import { listSysDepts, createSysDept, updateSysDept, deleteSysDept, listSysUsers } from '@/api/system'
import { ensureNames, displayUserName } from '@/utils/subjectNames'

const loading = ref(false)
const rows = ref<any[]>([])
const userLoading = ref(false)
/** 可选负责人：value 用字符串（雪花 ID 超出 JS 安全整数范围） */
const userOptions = ref<{ id: string; label: string; phone: string; email: string }[]>([])

/** 加载用户列表，供负责人下拉选取 */
async function loadUsers() {
  if (userLoading.value || userOptions.value.length) return
  userLoading.value = true
  try {
    const res: any = await listSysUsers({ pageNum: 1, pageSize: 500 })
    userOptions.value = (res?.rows || []).map((u: any) => ({
      id: String(u.userId),
      label: `${u.nickName || u.userName}${u.userName ? `(${u.userName})` : ''}`,
      phone: u.phoneNumber || '',
      email: u.email || ''
    }))
  } catch (e) {
    userOptions.value = []
  } finally {
    userLoading.value = false
  }
}

/** 选定负责人后，带出该用户的联系电话与邮箱 */
function onLeaderChange(userId?: string) {
  if (!userId) return
  const u = userOptions.value.find(x => x.id === String(userId))
  if (!u) return
  form.phone = u.phone
  form.email = u.email
  ElMessage.success(`已带出「${u.label}」的联系电话与邮箱`)
}

const dialog = reactive({ visible: false, mode: 'add' as 'add' | 'edit', title: '' })
const form = reactive<any>({})

async function load() {
  loading.value = true
  try {
    rows.value = await listSysDepts()
    // 负责人列显示真实姓名：批量解析部门负责人 ID
    ensureNames('user', collectLeaders(rows.value))
  } finally {
    loading.value = false
  }
}

/** 递归收集所有部门的负责人 ID（部门是树形结构） */
function collectLeaders(list: any[]): string[] {
  const ids: string[] = []
  const walk = (nodes: any[]) => nodes.forEach(n => {
    if (n.leader) ids.push(String(n.leader))
    if (n.children?.length) walk(n.children)
  })
  walk(list || [])
  return ids
}

function openAdd(parent?: any) {
  loadUsers()
  dialog.mode = 'add'
  dialog.title = '新增部门'
  Object.keys(form).forEach(k => delete form[k])
  form.parentId = parent ? parent.deptId : 0
  form.orderNum = 0
  form.status = '0'
  dialog.visible = true
}

function openEdit(row: any) {
  loadUsers()
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

onMounted(() => {
  load()
  loadUsers()
})
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
