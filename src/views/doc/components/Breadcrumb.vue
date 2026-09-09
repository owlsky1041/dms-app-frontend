<template>
  <el-breadcrumb separator="/">
    <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
    <el-breadcrumb-item
      v-for="(item, idx) in path"
      :key="item.folderId"
      @click="$emit('navigate', item.folderId)"
    >
      {{ item.folderName }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script setup lang="ts">
import type { Folder } from '@/types/doc'

defineProps<{
  path: Folder[]
}>()

defineEmits<{
  (e: 'navigate', folderId: number): void
}>()
</script>
