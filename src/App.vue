<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { useTasksStore } from "@/stores/tasks";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { watchThemePersistence } from "@/stores/theme";
import { Button } from "@/components/ui/button";
import Summary from "@/components/Summary.vue";
import SortModeToggle from "@/components/SortModeToggle.vue";
import SettingsPanel from "@/components/SettingsPanel.vue";
import TaskList from "@/components/TaskList.vue";
import DoneList from "@/components/DoneList.vue";
import TaskForm from "@/components/TaskForm.vue";
import type { Task } from "@/types/task";
import { Plus, ListChecks } from "lucide-vue-next";

const store = useTasksStore();
const settings = useSettingsStore();
const themeStore = useThemeStore();

const formOpen = ref(false);
const editingTask = ref<Task | null>(null);

function openAddDialog() {
  editingTask.value = null;
  formOpen.value = true;
}

function openEditDialog(task: Task) {
  editingTask.value = task;
  formOpen.value = true;
}

async function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (e.shiftKey) {
      // Shift+Esc = خروج کامل از برنامه (نه فقط مخفی‌کردن به System Tray).
      e.preventDefault();
      await invoke("quit_app");
      return;
    }

    if (formOpen.value) {
      formOpen.value = false;
    } else {
      e.preventDefault();
      // ESC ساده فقط پنجره را می‌بندد که سمت Rust به‌جای بستن واقعی،
      // به پس‌زمینه (System Tray) منتقل می‌شود.
      await getCurrentWindow().close();
    }
    return;
  }
}

/**
 * دابل‌کلیک روی فضای خالی پنجره = باز شدن فرم افزودن تسک جدید.
 * جایگزین میانبر کیبورد قبلی (کلید N).
 *
 * نکته‌ی مهم: این هندلر فقط روی خودِ عنصر container صدا زده می‌شود، نه
 * روی فرزندانش (کارت‌های تسک، دکمه‌ها، هدر و...). با چک
 * `e.target === e.currentTarget` مطمئن می‌شویم دابل‌کلیک روی یک تسک یا
 * دکمه — که event تا اینجا بابل می‌کند — باعث باز شدن اشتباهی فرم
 * «افزودن» نمی‌شود؛ فقط دابل‌کلیک روی فضای واقعاً خالی اثر می‌کند.
 */
function onBackgroundDblClick(e: MouseEvent) {
  if (formOpen.value) return;
  if (e.target !== e.currentTarget) return;
  openAddDialog();
}

onMounted(async () => {
  // اعمال تم و حالت شیشه‌ای از localStorage
  themeStore.init();
  watchThemePersistence(themeStore);

  store.init();
  window.addEventListener("keydown", onGlobalKeydown);
  await settings._applyWindowMode();
  await settings._applyTitleBar();
});

onUnmounted(() => {
  store.stopTicker();
  window.removeEventListener("keydown", onGlobalKeydown);
});
</script>

<template>
  <div class="min-h-screen bg-background" @dblclick="onBackgroundDblClick">
    <div
      class="mx-auto flex flex-col gap-5 px-4 py-6 sm:py-10"
      :class="settings.sidebarMode ? 'max-w-full' : 'max-w-2xl'"
      @dblclick="onBackgroundDblClick"
    >
      <!-- Header -->
      <header
        class="relative flex items-center justify-between gap-2"
        :data-tauri-drag-region="!settings.sidebarMode ? true : undefined"
      >
        <div
          class="flex min-w-0 items-center gap-2"
          :data-tauri-drag-region="!settings.sidebarMode ? true : undefined"
        >
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ListChecks class="h-5 w-5" aria-hidden="true" />
          </span>
          <h1
            class="truncate text-lg font-extrabold tracking-tight"
            :class="themeStore.glassEnabled ? 'rounded-lg px-2.5 py-0.5 bg-[var(--glass-card)] shadow-[var(--glass-shadow)]' : ''"
          >
            اولویت روزانه
          </h1>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <Button
            size="icon"
            class="h-9 w-9"
            @click="openAddDialog"
            aria-label="افزودن کار جدید"
            title="افزودن کار جدید"
          >
            <Plus class="h-4 w-4" aria-hidden="true" />
          </Button>
          <SortModeToggle />
          <Summary />
          <SettingsPanel />
        </div>
      </header>

      <p v-if="store.loading" class="py-10 text-center text-sm text-muted-foreground">در حال بارگذاری...</p>
      <p v-else-if="store.error" class="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        خطا در بارگذاری اطلاعات: {{ store.error }}
      </p>

      <template v-else>
        <TaskList @edit="openEditDialog" />
        <DoneList @edit="openEditDialog" />
      </template>
    </div>

    <TaskForm v-model:open="formOpen" :task="editingTask" />
  </div>
</template>