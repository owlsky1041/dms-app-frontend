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
      <el-table-column prop="roleSort" label="显示顺序" width="90" align="center" />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'">
            {{ row.status === '0' ? '正常' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="130" show-overflow-tooltip />
      <el-table-column label="创建时间" width="165">
        <template #default="{ row }">{{ row.createTime }}</template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" link type="success" :icon="Key" @click="openPerm(row)">分配权限</el-button>
          <el-popconfirm title="确认删除该角色？" @confirm="removeRole(row)">
            <template #reference>
              <el-button size="small" link type="danger" :icon="Delete">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑角色 -->
    <el-dialog v-model="dialog.visible" :title="dialog.title" width="480px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="角色名称" required>
          <el-input v-model="form.roleName" />
        </el-form-item>
        <el-form-item label="权限字符" required>
          <el-input v-model="form.roleKey" />
        </el-form-item>
        <el-form-item label="显示顺序">
          <el-input-number v-model="form.roleSort" :min="0" />
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

    <!-- 分配菜单权限 -->
    <el-dialog v-model="perm.visible" :title="perm.title" width="560px">
      <div style="margin-bottom:8px">
        <el-button size="small" @click="checkAllMenus(true)">全选</el-button>
        <el-button size="small" @click="checkAllMenus(false)">全不选</el-button>
        <el-button size="small" @click="expandAll(true)">展开</el-button>
        <el-button size="small" @click="expandAll(false)">折叠</el-button>
      </div>
      <el-tree
        ref="menuTreeRef"
        :data="perm.menus"
        node-key="menuId"
        show-checkbox
        :props="{ label: 'menuName', children: 'children' }"
        :default-expand-all="true"
        style="max-height:420px;overflow:auto;border:1px solid #ebeef5;border-radius:4px;padding:8px"
      />
      <template #footer>
        <el-button @click="perm.visible = false">取消</el-button>
        <el-button type="primary" @click="savePerm">保存权限</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, nextTick, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Edit, Delete, Refresh, Key } from '@element-plus/icons-vue'
import {
  listSysRoles, createSysRole, updateSysRole, deleteSysRole,
  getRoleMenuTree, getRoleDeptTree, saveRolePermission
} from '@/api/system'

const loading = ref(false)
const rows = ref<any[]>([])
const dialog = reactive({ visible: false, mode: 'add' as 'add' | 'edit', title: '' })
const form = reactive<any>({})
const perm = reactive<any>({ visible: false, title: '', roleId: '', menus: [], deptIds: [] })
const menuTreeRef = ref<any>(null)

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
  form.roleSort = 0
  form.status = '0'
  dialog.visible = true
}

function openEdit(row: any) {
  dialog.mode = 'edit'
  dialog.title = `编辑角色 - ${row.roleName}`
  Object.keys(form).forEach(k => delete form[k])
  Object.assign(form, row)
  dialog.visible = true
}

async function save() {
  try {
    if (dialog.mode === 'add') {
      // createSysRole 内部补齐 menuIds/deptIds 空数组，避免后端 NPE
      await createSysRole({ ...form })
    } else {
      await updateSysRole({ ...form })
    }
    ElMessage.success('保存成功')
    dialog.visible = false
    load()
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.message || e?.msg || '未知错误'}`)
  }
}

async function openPerm(row: any) {
  perm.title = `分配权限 - ${row.roleName}`
  perm.roleId = row.roleId
  perm.visible = true
  perm.menus = []
  try {
    const [menuTree, deptTree] = await Promise.all([
      getRoleMenuTree(row.roleId),
      getRoleDeptTree(row.roleId).catch(() => ({ depts: [], checkedKeys: [] }))
    ])
    perm.menus = menuTree?.menus || []
    // 数据权限部门：此处不做编辑，仅原样保留，避免保存时被清空
    perm.deptIds = (deptTree?.checkedKeys || []).map((x: any) => String(x))
    await nextTick()
    const checked = (menuTree?.checkedKeys || []).map((x: any) => String(x))
    menuTreeRef.value?.setCheckedKeys(checked, false)
  } catch (e: any) {
    ElMessage.error(`加载权限失败：${e?.message || e?.msg || '未知错误'}`)
  }
}

function checkAllMenus(checked: boolean) {
  const all: any[] = []
  const walk = (list: any[]) => list.forEach(n => { all.push(n.menuId); if (n.children) walk(n.children) })
  walk(perm.menus)
  menuTreeRef.value?.setCheckedKeys(checked ? all : [], false)
}

function expandAll(open: boolean) {
  const nodes = menuTreeRef.value?.store?.nodesMap || {}
  Object.values(nodes).forEach((n: any) => { n.expanded = open })
}

async function savePerm() {
  try {
    const menuIds = [
      ...(menuTreeRef.value?.getCheckedKeys() || []),
      ...(menuTreeRef.value?.getHalfCheckedKeys() || [])
    ].map((x: any) => String(x))
    await saveRolePermission(perm.roleId, menuIds, perm.deptIds)
    ElMessage.success('权限保存成功')
    perm.visible = false
  } catch (e: any) {
    ElMessage.error(`权限保存失败：${e?.message || e?.msg || '未知错误'}`)
  }
}

async function removeRole(row: any) {
  try {
    await deleteSysRole(row.roleId)
    ElMessage.success('已删除')
    load()
  } catch (e: any) {
    ElMessage.error(`删除失败：${e?.message || e?.msg || '未知错误'}`)
  }
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
