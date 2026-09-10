<template>
  <el-dialog
    :model-value="visible"
    title="个人中心"
    width="500px"
    @update:model-value="(v) => $emit('update:visible', v)"
    @open="loadProfile"
  >
    <el-tabs v-model="activeTab">
      <!-- 基本资料 -->
      <el-tab-pane label="基本资料" name="basic">
        <el-form :model="form" label-width="90px">
          <el-form-item label="用户名">
            <el-input :model-value="profile.userName" disabled />
          </el-form-item>
          <el-form-item label="真实姓名" required>
            <el-input v-model="form.nickName" />
          </el-form-item>
          <el-form-item label="手机号码">
            <el-input v-model="form.phoneNumber" />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="form.email" />
          </el-form-item>
          <el-form-item label="性别">
            <el-radio-group v-model="form.gender">
              <el-radio value="1">男</el-radio>
              <el-radio value="2">女</el-radio>
              <el-radio value="0">未知</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="所属部门">
            <el-input :model-value="profile.deptName" disabled />
          </el-form-item>
          <el-form-item label="角色">
            <template v-if="profile.roles && profile.roles.length">
              <el-tag
                v-for="r in profile.roles"
                :key="r.roleId"
                size="small"
                style="margin-right:4px"
              >{{ r.roleName }}</el-tag>
            </template>
            <span v-else style="color:#c0c4cc">未分配</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveProfile">保存资料</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 修改密码 -->
      <el-tab-pane label="修改密码" name="pwd">
        <el-form :model="pwd" label-width="90px">
          <el-form-item label="当前密码" required>
            <el-input v-model="pwd.oldPassword" type="password" show-password />
          </el-form-item>
          <el-form-item label="新密码" required>
            <el-input v-model="pwd.newPassword" type="password" show-password />
          </el-form-item>
          <el-form-item label="确认新密码" required>
            <el-input v-model="pwd.confirmPassword" type="password" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="savePwd">确认修改</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { getProfile, updateProfile, updateOwnPwd } from '@/api/system'
import { useUserStore } from '@/stores/user'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const userStore = useUserStore()
const activeTab = ref('basic')
const profile = ref<any>({})
const form = reactive<any>({})
const pwd = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

async function loadProfile() {
  try {
    const data: any = await getProfile()
    profile.value = data?.user ? { ...data, ...data.user } : data
    form.nickName = profile.value.nickName
    form.phoneNumber = profile.value.phoneNumber
    form.email = profile.value.email
    form.gender = profile.value.gender || '0'
  } catch (e) {
    ElMessage.error('加载个人资料失败')
  }
}

async function saveProfile() {
  if (!form.nickName) { ElMessage.warning('真实姓名不能为空'); return }
  try {
    await updateProfile({
      nickName: form.nickName,
      phoneNumber: form.phoneNumber,
      email: form.email,
      gender: form.gender
    })
    ElMessage.success('资料已保存')
    userStore.nickname = form.nickName
    userStore.saveToStorage?.()
  } catch { /* http 层提示 */ }
}

async function savePwd() {
  if (!pwd.oldPassword || !pwd.newPassword) { ElMessage.warning('请填写完整'); return }
  if (pwd.newPassword !== pwd.confirmPassword) { ElMessage.warning('两次输入的新密码不一致'); return }
  try {
    await updateOwnPwd(pwd.oldPassword, pwd.newPassword)
    ElMessage.success('密码修改成功，请重新登录')
    pwd.oldPassword = pwd.newPassword = pwd.confirmPassword = ''
    emit('update:visible', false)
  } catch { /* http 层提示 */ }
}
</script>
