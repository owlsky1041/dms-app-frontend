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
      <el-table-column label="邮箱" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.email">{{ row.email }}</span>
          <el-tag v-else type="danger" size="small">未填写</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最后登录时间" width="165">
        <template #default="{ row }">
          <span v-if="row.loginDate">{{ formatTime(row.loginDate) }}</span>
          <span v-else style="color:#c0c4cc">从未登录</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === '0'"
            @change="(v: any) => toggleStatus(row, v)"
          />
        </template>
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
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="用户名" prop="userName">
          <el-input v-model="form.userName" :disabled="dialog.mode === 'edit'" />
        </el-form-item>
        <el-form-item v-if="dialog.mode === 'add'" label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="真实姓名" prop="nickName">
          <el-input v-model="form.nickName" />
        </el-form-item>
        <el-form-item label="手机">
          <el-input v-model="form.phoneNumber" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="找回密码要靠它发信，必填" />
        </el-form-item>
        <el-form-item label="部门">
          <el-tree-select
            v-model="form.deptId"
            :data="deptTree"
            node-key="deptId"
            :props="{ label: 'deptName', children: 'children' }"
            check-strictly
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="角色">
          <el-select
            v-model="form.roleIds"
            multiple
            :disabled="editingSelf"
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
          <div v-if="editingSelf" class="form-tip">
            不能修改自己的角色：否则可能把自己降级后再也没人能改回来。需要调整请由其他管理员操作。
          </div>
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
import { reactive, ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Plus, Edit, Delete, Key } from '@element-plus/icons-vue'
import {
  listSysUsers, createSysUser, updateSysUser, deleteSysUser,
  resetUserPwd, changeUserStatus, listSysDepts, listSysRoles,
  getSysUser, saveUserAuthRole
} from '@/api/system'
import { notifyError } from '@/api/http'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
const deptTree = ref<any[]>([])
const roleOptions = ref<any[]>([])
const roleNameById = computed<Record<string, string>>(() => {
  const m: Record<string, string> = {}
  roleOptions.value.forEach((r: any) => { m[String(r.roleId)] = r.roleName })
  return m
})

const query = reactive({ userName: '', status: '', pageNum: 1, pageSize: 20 })


const dialog = reactive({ visible: false, mode: 'add' as 'add' | 'edit', title: '' })
const form = reactive<any>({})
const formRef = ref<any>()

/**
 * 表单校验
 *
 * 邮箱是必填项而不是可选项：找回密码要靠它发信，没有邮箱的账号一旦忘记密码
 * 就只能人工进库重置。后端 SysUserBo 上同样加了 @NotBlank，两边一起拦。
 */
const rules = {
  userName: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 30, message: '长度 2 到 30 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 5, max: 20, message: '长度 5 到 20 个字符', trigger: 'blur' }
  ],
  nickName: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  email: [
    { required: true, message: '邮箱不能为空（找回密码需要它）', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'change'] }
  ]
}

/** 列表里的时间统一格式化：后端返回的是 2026-09-13T00:12:33 这种 */
function formatTime(t?: string) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '—'
}

/**
 * 是否正在编辑当前登录用户自己
 *
 * 超管可以改自己的资料，但角色与状态必须锁住，否则一键就能把自己锁在系统外。
 * 以 userId 字符串比较：雪花 ID 超出 JS 安全整数范围，不能用 Number。
 */
const editingSelf = computed(() =>
  dialog.mode === 'edit' && String(form.userId || '') === String(userStore.userId || '')
)

const pwdDialog = reactive({ visible: false, userId: 0, userName: '', password: '' })

async function load() {
  loading.value = true
  try {
    const res = await listSysUsers(query)
    rows.value = res.rows
    total.value = res.total
    // 列表接口不返回角色；authRole 返回的是「可分配角色目录」（flag 标记），
    // 已分配角色以 GET /system/user/{id} 的 roleIds 为准（与数据库一致）
    if (!roleOptions.value.length) await loadRoleOptions()
    await Promise.all(rows.value.map(async (row: any) => {
      try {
        const info: any = await getSysUser(row.userId)
        const ids: string[] = (info?.roleIds || []).map((x: any) => String(x))
        row._roleIds = ids
        row._roleNames = ids.map((id: string) => roleNameById.value[id]).filter(Boolean)
      } catch { row._roleIds = []; row._roleNames = [] }
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
  nextTick(() => formRef.value?.clearValidate())
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
  form.roleIds = [...(row._roleIds || [])]
  dialog.visible = true
  nextTick(() => formRef.value?.clearValidate())
  // 回显已分配角色：GET /system/user/{id} 的 roleIds 是唯一权威来源
  try {
    const info: any = await getSysUser(row.userId)
    form.roleIds = (info?.roleIds || []).map((x: any) => String(x))
  } catch { /* 保留列表中的数据 */ }
}

async function save() {
  // 先过表单校验：邮箱这类必填项不该等到后端返回 500 才知道
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  try {
    const payload: any = { ...form }
    const roleIds: string[] = (payload.roleIds || []).map((x: any) => String(x))
    delete payload.roles
    delete payload.roleIds
    Object.keys(payload).forEach(k => { if (k.startsWith('_')) delete payload[k] })
    if (dialog.mode === 'add') {
      await createSysUser(payload)
    } else {
      await updateSysUser(payload)
    }
    // 改的是自己：角色不允许动，跳过角色同步直接收工
    if (editingSelf.value) {
      ElMessage.success('保存成功')
      dialog.visible = false
      load()
      return
    }
    // 同步角色关联（新增时后端不回传 userId，按用户名回查）
    let uid = payload.userId || form.userId
    if (!uid && dialog.mode === 'add' && payload.userName) {
      const res: any = await listSysUsers({ userName: payload.userName, pageNum: 1, pageSize: 1 })
      uid = res?.rows?.[0]?.userId
    }
    // 必须无条件调用：确认角色确实下发（否则表现为「保存成功但没修改」）
    if (roleIds.length === 0) {
      // RuoYi 后端 insertUserRole 对空数组直接 return（静默不改），无法清空全部角色
      ElMessage.warning('请至少保留一个角色：后端不支持清空用户全部角色')
      return
    }
    if (!uid) throw new Error('未能确定用户ID，角色未保存')
    await saveUserAuthRole(uid, roleIds)
    ElMessage.success(dialog.mode === 'add' ? '创建成功' : '保存成功')
    dialog.visible = false
    load()
  } catch (e: any) {
    // 后端 msg 已由 http 拦截器弹出，这里不再重复弹一遍
    notifyError(e, '保存失败')
  }
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
.form-tip {
  color: #e6a23c;
  font-size: 12px;
  line-height: 1.6;
  margin-top: 4px;
}

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
