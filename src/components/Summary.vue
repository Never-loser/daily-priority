<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useTasksStore } from "@/stores/tasks";
import { toPersianDigits } from "@/lib/persian";
import { Button } from "@/components/ui/button";
import { ListTodo, Flame, TimerIcon } from "lucide-vue-next";

const store = useTasksStore();
const summary = computed(() => store.summary);

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return;
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener("click", onDocumentClick));
onUnmounted(() => document.removeEventListener("click", onDocumentClick));
</script>

<template>
  <!-- بدون کلاس relative: عمداً — پنل absolute زیر این‌جا نسبت به
       نزدیک‌ترین جد position:relative (یعنی خودِ <header> در App.vue که
       عرض کامل صفحه را دارد) موقعیت می‌گیرد، نه نسبت به این دکمه‌ی
       باریک. این‌طوری با هر عرض پنجره‌ای، پنل از لبه‌ی صفحه بیرون نمی‌زند. -->
  <div ref="rootEl">
    <Button
      size="icon"
      variant="outline"
      class="h-9 w-9"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-label="نمایش وضعیت کارها"
      title="نمایش وضعیت کارها"
      @click="open = !open"
    >
      <ListTodo class="h-4 w-4" aria-hidden="true" />
    </Button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-1"
    >
      <div
        v-if="open"
        class="absolute end-0 top-11 z-50 w-48 rounded-xl border border-border bg-card p-1.5 shadow-lg"
        role="menu"
        aria-label="وضعیت کارها"
      >
        <div class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-card-foreground">
          <ListTodo class="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span class="flex-1 text-start">کل کارها</span>
          <span class="tabular font-semibold">{{ toPersianDigits(summary.total) }}</span>
        </div>

        <div class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-card-foreground">
          <Flame class="h-3.5 w-3.5 shrink-0 text-prio-high" aria-hidden="true" />
          <span class="flex-1 text-start">
            اولویت بالا <span class="text-muted-foreground">(۴-۵)</span>
          </span>
          <span class="tabular font-semibold">{{ toPersianDigits(summary.highPriority) }}</span>
        </div>

        <div class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-card-foreground">
          <TimerIcon class="h-3.5 w-3.5 shrink-0 text-prio-low" aria-hidden="true" />
          <span class="flex-1 text-start">تایمر فعال</span>
          <span class="tabular font-semibold">{{ toPersianDigits(summary.activeTimers) }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>