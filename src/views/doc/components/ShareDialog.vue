<template>
  <el-dialog
    v-model="visible"
    :title="`共享给… — ${resourceName || ''}`"
    width="560px"
    :close-on-click-modal="false"
    append-to-body
    @open="init"
  >
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="share-tip"
      title="共享即「把访问权限授予他人」"
      :description="`选择人员/角色/部门并勾选权限，确认后立即生效。需要查看或撤销已有授权，请用右键菜单里的「权限设置」。`"
    />

    <el-form label-width="80px" size="default" class="share-form">
      <el-form-item label="共享给">
        <el-radio-group v-model="subjectType" @change="onTypeChange">
          <el-radio-button value="user">用户</el-radio-button>
          <el-radio-button value="role">角色</el-radio-button>
          <el-radio-button value="dept">部门</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="选择主体">
        <el-select
          v-model="selected"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          :loading="loading"
          :placeholder="`可多选，支持搜索（${labelMap[subjectType]}）`"
          style="width: 100%"
          @visible-change="(open: boolean) => open && loadOptions()"
        >
          <el-option v-for="o in options" :key="o.key" :label="o.label" :value="o.key" />
        </el-select>
      </el-form-item>

      <el-form-item label="权限档位">
        <el-radio-group v-model="levelKey" class="level-group">
          <el-radio v-for="l in PERM_LEVELS" :key="l.key" :value="l.key" class="level-radio">
            <span class="level-label" :class="l.key">{{ l.label }}</span>
            <span class="level-desc">{{ l.desc }}</span>
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="下载">
        <el-switch
          v-model="downloadEnabled"
          :disabled="!downloadSelectable"
          active-text="允许下载原件"
        />
        <div class="preset-desc">
          <template v-if="levelKey === 'deny'">禁止访问时下载无意义，已锁定关闭。</template>
          <template v-else-if="levelKey === 'full'">「完全控制」已包含下载。</template>
          <template v-else>关闭时对方只能在线预览，原件带不走。</template>
        </div>
      </el-form-item>

      <el-form-item v-if="resourceType === 'folder'" label="继承">
        <el-switch v-model="inheritToChildren" active-text="应用到子文件夹和文件" />
      </el-form-item>

      <el-form-item label="有效期">
        <el-date-picker
          v-model="expiresAt"
          type="datetime"
          placeholder="留空=永久有效"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="submit">
        {{ submitText }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { grantFile, grantFolder, getSubjects } from '@/api/doc'
import { PERM_LEVELS, PERM_DENY, PERM_DOWNLOAD } from '@/types/doc'

/**
 * 「共享给…」快速授权对话框
 *
 * 与「权限设置」的分工：
 *  - 共享给… = 只看「授予」，用预设（只读/可上传/完全控制）让常用的共享一步完成
 *  - 权限设置 = 完整对话框，能看到并撤销已有授权
 */
const props = defineProps<{
  modelValue: boolean
  resourceType: 'folder' | 'file'
  resourceId: number
  resourceName?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'changed'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

/**
 * 权限档位 + 下载开关
 *
 * 与「权限设置」弹窗用同一套档位定义（types/doc.ts 的 PERM_LEVELS），
 * 保证两个入口配出来的权限语义完全一致。
 */
const levelKey = ref<string>('readonly')
const downloadEnabled = ref(false)

/** 只有只读/读写档可以单独叠加下载 */
const downloadSelectable = computed(() => levelKey.value === 'readonly' || levelKey.value === 'readwrite')

watch([levelKey, downloadSelectable], () => {
  if (levelKey.value === 'deny') downloadEnabled.value = false
  if (levelKey.value === 'full') downloadEnabled.value = true
}, { immediate: true })

/** 最终提交的位掩码 */
const permFlags = computed(() => {
  const def = PERM_LEVELS.find(l => l.key === levelKey.value) || PERM_LEVELS[0]
  if (def.key === 'deny') return PERM_DENY
  return def.flags | (downloadEnabled.value ? PERM_DOWNLOAD : 0)
})

const labelMap = { user: '用户', role: '角色', dept: '部门' } as const

const subjectType = ref<'user' | 'role' | 'dept'>('user')
const selected = ref<string[]>([])
const options = ref<{ key: string; label: string }[]>([])
const loading = ref(false)
const inheritToChildren = ref(true)
const expiresAt = ref<string | null>(null)
const submitting = ref(false)

const canSubmit = computed(() => selected.value.length > 0 && permFlags.value !== 0)

const submitText = computed(() =>
  selected.value.length > 1 ? `共享给 ${selected.value.length} 个主体` : '共享')

function init() {
  selected.value = []
  // 默认「只读」、不含下载：共享出去最保守的档位，需要再加
  levelKey.value = 'readonly'
  downloadEnabled.value = false
  inheritToChildren.value = true
  expiresAt.value = null
  loadOptions()
}

function onTypeChange() {
  selected.value = []
  loadOptions()
}

/** 载入候选主体；ID 一律保持字符串（雪花 ID 超 JS 安全整数范围） */
async function loadOptions() {
  if (loading.value) return
  loading.value = true
  try {
    const subjects = await getSubjects()
    options.value = subjectType.value === 'user'
      ? subjects.users.map(o => ({ key: o.id, label: o.label }))
      : subjectType.value === 'role'
        ? subjects.roles.map(o => ({ key: o.id, label: o.label }))
        : subjects.depts.map(o => ({ key: o.id, label: o.label }))
  } catch {
    options.value = []
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  let ok = 0
  const failed: string[] = []
  try {
    for (const subjectId of selected.value) {
      const payload = {
        subjectType: subjectType.value,
        subjectId,
        permFlags: permFlags.value,
        inheritToChildren: inheritToChildren.value,
        expiresAt: expiresAt.value || null
      }
      try {
        if (props.resourceType === 'folder') {
          await grantFolder(props.resourceId, payload as any)
        } else {
          await grantFile(props.resourceId, payload as any)
        }
        ok++
      } catch {
        failed.push(`「${options.value.find((o) => o.key === subjectId)?.label || subjectId}」授权失败`)
      }
    }
    if (ok) {
      ElMessage.success(levelKey.value === 'deny'
        ? `已设置 ${ok} 个主体禁止访问`
        : `已共享给 ${ok} 个主体（${PERM_LEVELS.find(l => l.key === levelKey.value)?.label || ''}${downloadEnabled.value ? ' + 下载' : ''}）`)
      emit('changed')
      visible.value = false
    }
    if (failed.length) ElMessage.warning(failed.join('、'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.share-tip {
  margin-bottom: 16px;
}

/* 档位单选：一行一档 + 说明，与「权限设置」弹窗保持一致 */
.level-group {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.level-radio {
  height: auto;
  margin-right: 0 !important;
  padding: 5px 0;
  align-items: flex-start;

  :deep(.el-radio__label) {
    display: flex;
    flex-direction: column;
    gap: 2px;
    white-space: normal;
    line-height: 1.5;
  }
}

.level-label {
  font-weight: 600;

  &.deny { color: #f56c6c; }
  &.full { color: #e6a23c; }
  &.readwrite { color: #409eff; }
}

.level-desc {
  color: #909399;
  font-size: 12px;
}

.preset-group {
  margin-bottom: 4px;
}

.preset-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
}

.share-form :deep(.el-form-item__content) {
  flex-direction: column;
  align-items: stretch;
}

.share-form :deep(.el-form-item__content > .el-radio-group),
.share-form :deep(.el-form-item__content > .el-checkbox-group),
.share-form :deep(.el-form-item__content > .el-switch) {
  align-self: flex-start;
}
</style>
