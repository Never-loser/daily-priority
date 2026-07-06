<script setup lang="ts">
import { computed, ref } from "vue";
import { useTasksStore } from "@/stores/tasks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import PriorityMeter from "@/components/PriorityMeter.vue";
import TimerControl from "@/components/TimerControl.vue";
import { priorityLabel } from "@/lib/persian";
import type { Task } from "@/types/task";
import { GripVertical, Pencil, Trash2 } from "lucide-vue-next";

interface Props {
  task: Task;
  /** Show the drag handle (only meaningful in manual sort mode). */
  draggable?: boolean;
}
const props = withDefaults(defineProps<Props>(), { draggable: false });
const emit = defineEmits<{ edit: [task: Task] }>();

const store = useTasksStore();
const confirmDeleteOpen = ref(false);

const zoneVariant = computed(() => (props.task.priority >= 4 ? "high" : props.task.priority >= 3 ? "mid" : "low"));

async function onToggleComplete() {
  await store.toggleCompleted(props.task.id);
}

// دیالوگ تأیید داخل‌برنامه‌ای به‌جای window.confirm() بومی: چون
// window.confirm() یک پنجره‌ی native مستقل از WebView2 است و عرض خودش
// را دارد — در پنجره‌ی باریک ما (۲۶۰px) به‌راحتی از لبه بیرون می‌زند.
function askDelete() {
  confirmDeleteOpen.value = true;
}

async function confirmDelete() {
  confirmDeleteOpen.value = false;
  await store.removeTask(props.task.id);
}
</script>

<template>
  <Card
    class="animate-pop-in flex flex-col gap-3 p-4 transition-shadow"
    :class="task.is_completed ? 'opacity-70' : 'hover:shadow-md'"
  >
    <div class="flex items-start gap-3">
      <!-- Drag handle: only rendered in manual sort mode; vuedraggable targets this.
           draggable="false" + user-drag:none stop the browser's native HTML5
           drag (SVG/img elements are draggable by default in Chromium/WebView2),
           which otherwise fights with Sortable.js and shows a "not-allowed" cursor. -->
      <span
        v-if="draggable"
        class="drag-handle mt-1 shrink-0 cursor-grab select-none text-muted-foreground active:cursor-grabbing"
        style="-webkit-user-drag: none; user-drag: none;"
        draggable="false"
        title="برای جابه‌جایی بکشید"
      >
        <GripVertical class="h-5 w-5" draggable="false" aria-hidden="true" />
      </span>

      <!-- Completion checkbox -->
      <button
        type="button"
        role="checkbox"
        :aria-checked="task.is_completed"
        class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
        :class="task.is_completed ? 'border-primary bg-primary' : 'border-muted-foreground/40 hover:border-primary'"
        @click="onToggleComplete"
      >
        <svg v-if="task.is_completed" viewBox="0 0 24 24" class="h-3 w-3 text-primary-foreground" fill="none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <div class="min-w-0 flex-1 space-y-1">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <h3
            class="break-words font-semibold leading-snug"
            :class="task.is_completed ? 'text-muted-foreground line-through' : 'text-foreground'"
          >
            {{ task.title }}
          </h3>

          <Badge :variant="zoneVariant" class="flex shrink-0 items-center gap-1.5">
            <PriorityMeter :priority="task.priority" size="sm" />
            {{ priorityLabel(task.priority) }}
          </Badge>
        </div>

        <p
          v-if="task.description"
          class="whitespace-pre-wrap break-words text-sm"
          :class="task.is_completed ? 'text-muted-foreground/70 line-through' : 'text-muted-foreground'"
        >
          {{ task.description }}
        </p>
      </div>

      <!-- Row actions -->
      <div class="flex shrink-0 items-center gap-1">
        <Button size="icon" variant="ghost" class="h-8 w-8" aria-label="ویرایش" @click="emit('edit', task)">
          <Pencil class="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button size="icon" variant="ghost" class="h-8 w-8 text-destructive hover:bg-destructive/10" aria-label="حذف" @click="askDelete">
          <Trash2 class="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>

    <TimerControl v-if="!task.is_completed" :task="task" />

    <Dialog :open="confirmDeleteOpen" title="حذف کار" @update:open="confirmDeleteOpen = $event">
      <p class="text-sm text-muted-foreground">
        کار «<span class="font-semibold text-foreground">{{ task.title }}</span>» حذف شود؟ این عمل قابل بازگشت نیست.
      </p>
      <div class="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" @click="confirmDeleteOpen = false">انصراف</Button>
        <Button type="button" variant="destructive" @click="confirmDelete">حذف</Button>
      </div>
    </Dialog>
  </Card>
</template>