<script setup lang="ts">
import { ref } from "vue";
import { useTasksStore } from "@/stores/tasks";
import TaskCard from "@/components/TaskCard.vue";
import { toPersianDigits } from "@/lib/persian";
import { ChevronDown } from "lucide-vue-next";
import type { Task } from "@/types/task";

defineEmits<{ edit: [task: Task] }>();
const store = useTasksStore();
const open = ref(false);
</script>

<template>
  <div v-if="store.doneTasks.length > 0" class="space-y-3">
    <button
      type="button"
      class="flex w-full items-center justify-between rounded-lg px-1 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      @click="open = !open"
    >
      <span>تکمیل‌شده ({{ toPersianDigits(store.doneTasks.length) }})</span>
      <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': open }" aria-hidden="true" />
    </button>

    <div v-show="open" class="flex flex-col gap-3">
      <TaskCard v-for="task in store.doneTasks" :key="task.id" :task="task" @edit="$emit('edit', $event)" />
    </div>
  </div>
</template>
