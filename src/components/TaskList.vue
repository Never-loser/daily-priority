<script setup lang="ts">
import { ref, watch } from "vue";
import draggable from "vuedraggable";
import { useTasksStore } from "@/stores/tasks";
import TaskCard from "@/components/TaskCard.vue";
import type { Task } from "@/types/task";

const emit = defineEmits<{ edit: [task: Task] }>();
const store = useTasksStore();

// vuedraggable needs a writable array to v-model. We mirror the store's
// sorted getter into a local ref and write back through the store action
// (which persists sort_order) once a drag finishes.
const localList = ref<Task[]>([...store.visibleActiveTasks]);

watch(
  () => store.visibleActiveTasks,
  (next) => {
    localList.value = next;
  },
);

async function onDragEnd() {
  if (store.sortMode !== "manual") return;
  await store.applyManualOrder(localList.value);
}
</script>

<template>
  <p
    v-if="localList.length === 0"
    class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
  >
    هنوز کاری اضافه نشده. با دکمه «افزودن کار جدید» شروع کنید.
  </p>

  <draggable
    v-else
    v-model="localList"
    item-key="id"
    tag="div"
    class="flex flex-col gap-3"
    handle=".drag-handle"
    :animation="180"
    ghost-class="drag-ghost"
    chosen-class="drag-chosen"
    :disabled="store.sortMode !== 'manual'"
    @end="onDragEnd"
  >
    <template #item="{ element }">
      <TaskCard :task="element" :draggable="store.sortMode === 'manual'" @edit="emit('edit', $event)" />
    </template>
  </draggable>
</template>
