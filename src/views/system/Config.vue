<template>
  <div class="sys-page">
    <div class="page-toolbar">
      <el-form inline>
        <el-form-item label="参数名称">
          <el-input v-model="query.configName" placeholder="搜索" clearable style="width: 160px" @keyup.enter="load" />
        </el-form-item>
        <el-form-item label="键名">
          <el-input v-model="query.configKey" placeholder="如 sys.upload" clearable style="width: 180px" @keyup.enter="load" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="load">搜索</el-button>
          <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column prop="configId" label="参数ID" width="80" />
      <el-table-column prop="configName" label="参数名称" min-width="150" />
      <el-table-column prop="configKey" label="参数键名" min-width="180">
        <template #default="{ row }"><el-tag type="info">{{ row.configKey }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="configValue" label="参数键值" min-width="120" />
      <el-table-column label="内置" width="80" align="center">
        <template #default="{ row }">
          {{ String(row.configType).toUpperCase() === 'Y' ? '是' : '否' }}
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="query.pageNum"
      v-model:page-size="query.pageSize"
      :total="total"
      layout="total, prev, pager, next"
      style="margin-top: 12px; justify-content: flex-end"
      @current-change="load"
    />

    <el-dialog v-model="dialog.visible" title="编辑参数" width="500px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="参数名称">
          <el-input v-model="form.configName" />
        </el-form-item>
        <el-form-item label="参数键名">
          <el-input v-model="form.configKey" :disabled="true" />
        </el-form-item>
        <el-form-item label="参数键值" required>
          <el-input v-model="form.configValue" type="textarea" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" />
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
import { Search, Refresh, Edit } from '@element-plus/icons-vue'
import { listSysConfigs, updateSysConfig } from '@/api/system'

const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
const query = reactive({ configName: '', configKey: '', pageNum: 1, pageSize: 20 })
const dialog = reactive({ visible: false })
const form = reactive<any>({})

async function load() {
  loading.value = true
  try {
    const res = await listSysConfigs(query)
    rows.value = res.rows
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.configName = ''
  query.configKey = ''
  load()
}

function openEdit(row: any) {
  Object.assign(form, row)
  dialog.visible = true
}

async function save() {
  try {
    await updateSysConfig(form)
    ElMessage.success('保存成功')
    dialog.visible = false
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
  margin-bottom: 8px;
}
</style>
