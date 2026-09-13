<template>
  <el-breadcrumb separator="/">
    <!--
      「首页」= 文档区根目录（folderId=0）。
      之前写的是 el-breadcrumb-item 的 :to="{ path: '/' }" —— 那是给 vue-router 用的，
      而这儿是「重新加载目录」而不是「换路由」，所以点了完全没反应。
      改成和后面几级一样走 navigate 事件。
    -->
    <el-breadcrumb-item>
      <span class="crumb-link" @click="$emit('navigate', 0)">首页</span>
    </el-breadcrumb-item>
    <el-breadcrumb-item
      v-for="(item, idx) in path"
      :key="item.folderId"
    >
      <!--
        最后一级是「当前所在目录」，再点它等于原地跳一次，没有意义；
        所以只有它不做成可点样式（否则鼠标变手状却什么都不发生 —— 正是之前「首页」的问题）。
      -->
      <span
        class="crumb-link"
        :class="{ 'is-current': idx === path.length - 1 }"
        @click="onClick(item, idx)"
      >{{ item.folderName }}</span>
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script setup lang="ts">
import type { Folder } from '@/types/doc'

const props = defineProps<{
  path: Folder[]
}>()

const emit = defineEmits<{
  (e: 'navigate', folderId: number): void
}>()

function onClick(item: Folder, idx: number) {
  // 当前目录不必再跳
  if (idx === props.path.length - 1) return
  emit('navigate', item.folderId)
}
</script>

<style scoped>
/* 可点的层级给手状光标；当前层级保持默认光标，避免"能点却没反应"的误导 */
.crumb-link {
  cursor: pointer;
  color: var(--el-color-primary);
}

.crumb-link:hover {
  text-decoration: underline;
}

.crumb-link.is-current {
  cursor: default;
  color: var(--el-text-color-regular);
}

.crumb-link.is-current:hover {
  text-decoration: none;
}
</style>
