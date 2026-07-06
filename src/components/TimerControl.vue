<script setup lang="ts">
import { ref, computed } from "vue";
import { useTasksStore } from "@/stores/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/lib/persian";
import type { Task } from "@/types/task";
import { Play, Pause, RotateCcw, Clock3, Check } from "lucide-vue-next";

interface Props {
  task: Task;
}
const props = defineProps<Props>();
const store = useTasksStore();

const remaining = computed(() => store.remainingSecondsFor(props.task));
const hasDuration = computed(() => props.task.timer_duration_seconds > 0);
const isRunning = computed(() => props.task.timer_status === "running");
const isPaused = computed(() => props.task.timer_status === "paused");
const isFinished = computed(() => props.task.timer_status === "finished");

const editingDuration = ref(false);
const days = ref(0);
const hours = ref(0);
const minutes = ref(25);
const seconds = ref(0);

function openEditor() {
  const total = props.task.timer_duration_seconds;
  days.value = Math.floor(total / 86400);
  hours.value = Math.floor((total % 86400) / 3600);
  minutes.value = Math.floor((total % 3600) / 60);
  seconds.value = total % 60;
  editingDuration.value = true;
}

async function confirmDuration() {
  const total =
    (days.value || 0) * 86400 +
    (hours.value || 0) * 3600 +
    (minutes.value || 0) * 60 +
    (seconds.value || 0);
  if (total <= 0) return;
  await store.setTimerDuration(props.task.id, total);
  editingDuration.value = false;
}

async function toggleRunning() {
  if (isRunning.value) await store.pauseTimer(props.task.id);
  else await store.startOrResumeTimer(props.task.id);
}

async function reset() {
  await store.resetTimer(props.task.id);
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
    <!-- Inline duration editor -->
    <div v-if="editingDuration" class="flex flex-1 flex-wrap items-center gap-2">
      <div class="flex items-center gap-1">
        <Input v-model.number="days" type="number" min="0" max="365" class="h-8 w-14 px-2 text-center" />
        <span class="text-xs text-muted-foreground">روز</span>
      </div>
      <div class="flex items-center gap-1">
        <Input v-model.number="hours" type="number" min="0" max="23" class="h-8 w-14 px-2 text-center" />
        <span class="text-xs text-muted-foreground">ساعت</span>
      </div>
      <div class="flex items-center gap-1">
        <Input v-model.number="minutes" type="number" min="0" max="59" class="h-8 w-14 px-2 text-center" />
        <span class="text-xs text-muted-foreground">دقیقه</span>
      </div>
      <div class="flex items-center gap-1">
        <Input v-model.number="seconds" type="number" min="0" max="59" class="h-8 w-14 px-2 text-center" />
        <span class="text-xs text-muted-foreground">ثانیه</span>
      </div>
      <Button size="icon" class="h-8 w-8" @click="confirmDuration">
        <Check class="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>

    <!-- Normal timer display + controls -->
    <template v-else>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :disabled="isRunning"
        @click="openEditor"
        title="تنظیم مدت‌زمان"
      >
        <Clock3 class="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <span
        class="min-w-[7rem] flex-none text-center font-mono text-base font-bold tabular"
        :class="isFinished ? 'animate-pulse-ring text-prio-high' : isRunning ? 'text-primary' : 'text-foreground'"
      >
        {{ hasDuration ? formatDuration(remaining) : "۰۰:۰۰" }}
      </span>

      <span v-if="isFinished" class="text-xs font-semibold text-prio-high">تمام شد!</span>

      <div class="mr-auto flex items-center gap-1">
        <Button
          v-if="hasDuration && !isFinished"
          size="icon"
          variant="secondary"
          class="h-8 w-8"
          :aria-label="isRunning ? 'توقف موقت' : 'شروع'"
          @click="toggleRunning"
        >
          <Pause v-if="isRunning" class="h-4 w-4" aria-hidden="true" />
          <Play v-else class="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          v-if="hasDuration && (isPaused || isRunning || isFinished)"
          size="icon"
          variant="outline"
          class="h-8 w-8"
          aria-label="بازنشانی تایمر"
          @click="reset"
        >
          <RotateCcw class="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </template>
  </div>
</template>