<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useTasksStore } from "@/stores/tasks";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PriorityMeter from "@/components/PriorityMeter.vue";
import { priorityLabel } from "@/lib/persian";
import type { Task } from "@/types/task";

interface Props {
  open: boolean;
  /** When set, the dialog edits this task instead of creating a new one. */
  task?: Task | null;
}
const props = withDefaults(defineProps<Props>(), { task: null });
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const store = useTasksStore();

const title = ref("");
const description = ref("");
const priority = ref(3);

const isEditing = computed(() => props.task != null);
const dialogTitle = computed(() => (isEditing.value ? "ویرایش کار" : "افزودن کار جدید"));

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    // Populate (edit) or reset (create) every time the dialog opens.
    title.value = props.task?.title ?? "";
    description.value = props.task?.description ?? "";
    priority.value = props.task?.priority ?? 3;
  },
  { immediate: true },
);

function close() {
  emit("update:open", false);
}

async function onSubmit() {
  const trimmed = title.value.trim();
  if (!trimmed) return;
  const payload = { title: trimmed, description: description.value.trim() || undefined, priority: priority.value };
  if (isEditing.value && props.task) {
    await store.editTask(props.task.id, payload);
  } else {
    await store.addTask(payload);
  }
  close();
}

/** Ctrl+Enter inside the description textarea also submits, for convenience. */
function onDescriptionKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    onSubmit();
  }
}
</script>

<template>
  <Dialog :open="open" :title="dialogTitle" @update:open="emit('update:open', $event)">
    <form class="space-y-4" @submit.prevent="onSubmit">
      <div class="space-y-1.5">
        <Label for="task-title">عنوان کار</Label>
        <Input
          id="task-title"
          v-model="title"
          placeholder="مثلاً: نوشتن گزارش هفتگی"
          autofocus
        />
      </div>

      <div class="space-y-1.5">
        <Label for="task-desc">توضیحات (اختیاری)</Label>
        <Textarea
          id="task-desc"
          v-model="description"
          placeholder="جزئیات بیشتر درباره این کار..."
          :rows="3"
          @keydown="onDescriptionKeydown"
        />
        <p class="text-xs text-muted-foreground">برای ثبت سریع، Ctrl+Enter را بزنید.</p>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label for="task-priority">اولویت</Label>
          <span class="flex items-center gap-2 text-sm font-semibold tabular">
            <PriorityMeter :priority="priority" size="sm" />
            {{ priorityLabel(priority) }}
          </span>
        </div>
        <input
          id="task-priority"
          v-model.number="priority"
          type="range"
          min="1"
          max="5"
          step="1"
          class="w-full accent-primary"
        />
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" @click="close">انصراف</Button>
        <Button type="submit">{{ isEditing ? "ذخیره تغییرات" : "افزودن کار" }}</Button>
      </div>
    </form>
  </Dialog>
</template>