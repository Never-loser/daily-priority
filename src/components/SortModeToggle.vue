<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useTasksStore } from "@/stores/tasks";
import { Button } from "@/components/ui/button";
import { GripVertical, ArrowDownWideNarrow, ArrowUpDown, Check } from "lucide-vue-next";

const store = useTasksStore();
const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

function select(mode: "manual" | "priority") {
  store.setSortMode(mode);
  open.value = false;
}

// بستن منو با کلیک بیرون از آن (تا وقتی کاربر روی بقیه‌ی صفحه کلیک می‌کند،
// منو به‌جای اینکه باز بماند، بسته شود).
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
      aria-label="مرتب‌سازی"
      title="مرتب‌سازی"
      @click="open = !open"
    >
      <ArrowUpDown class="h-4 w-4" aria-hidden="true" />
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
        aria-label="حالت مرتب‌سازی"
      >
        <button
          role="menuitem"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
          :class="store.sortMode === 'manual' ? 'bg-accent text-accent-foreground' : 'text-card-foreground'"
          @click="select('manual')"
        >
          <GripVertical class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span class="flex-1 text-start">جدیدترین بالا</span>
          <Check v-if="store.sortMode === 'manual'" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
        <button
          role="menuitem"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
          :class="store.sortMode === 'priority' ? 'bg-accent text-accent-foreground' : 'text-card-foreground'"
          @click="select('priority')"
        >
          <ArrowDownWideNarrow class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span class="flex-1 text-start">مرتب‌سازی بر اساس اولویت</span>
          <Check v-if="store.sortMode === 'priority'" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>