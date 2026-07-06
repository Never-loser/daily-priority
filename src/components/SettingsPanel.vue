<script setup lang="ts">
import { ref, watch } from "vue";
import { useThemeStore } from "@/stores/theme";
import { useSettingsStore } from "@/stores/settings";
import { Sun, Moon, PanelRight, Settings, X, Glasses, PanelTop, Power } from "lucide-vue-next";

const themeStore = useThemeStore();
const settings = useSettingsStore();

const open = ref(false);

function togglePanel() {
  open.value = !open.value;
}

// هر بار پنل باز می‌شود، وضعیت واقعی autostart از سیستم‌عامل خوانده
// می‌شود تا سوییچ همیشه با وضعیت واقعی هماهنگ باشد (نه فقط مقدار
// ذخیره‌شده در localStorage).
watch(open, (isOpen) => {
  if (isOpen) {
    settings.syncAutostartState();
  }
});
</script>

<template>
  <!-- دکمه باز/بست پنل -->
  <button
    class="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    :aria-label="open ? 'بستن تنظیمات' : 'باز کردن تنظیمات'"
    @click="togglePanel"
  >
    <X v-if="open" class="h-4 w-4" aria-hidden="true" />
    <Settings v-else class="h-4 w-4" aria-hidden="true" />
  </button>

  <!-- پنل -->
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
      class="absolute start-0 top-14 z-50 w-52 rounded-xl border border-border bg-card p-3 shadow-lg"
      role="dialog"
      aria-label="تنظیمات"
    >
      <h2 class="mb-4 text-sm font-bold text-card-foreground">تنظیمات</h2>

      <!-- ───── تم ───── -->
      <div class="mb-4">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">تم</p>
        <div class="flex gap-2">
          <button
            class="flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition"
            :class="
              themeStore.theme === 'light'
                ? 'border-primary bg-accent text-accent-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
            "
            @click="themeStore.set('light')"
          >
            <Sun class="h-4 w-4" aria-hidden="true" />
            روشن
          </button>
          <button
            class="flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition"
            :class="
              themeStore.theme === 'dark'
                ? 'border-primary bg-accent text-accent-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
            "
            @click="themeStore.set('dark')"
          >
            <Moon class="h-4 w-4" aria-hidden="true" />
            تاریک
          </button>
        </div>
      </div>

      <!-- ───── پس‌زمینه شیشه‌ای ───── -->
      <div class="mb-4 border-t border-border pt-4">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">پس‌زمینه</p>
        <button
          class="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition"
          :class="
            themeStore.glassEnabled
              ? 'border-primary bg-accent text-accent-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
          "
          @click="themeStore.toggleGlass()"
        >
          <Glasses class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="flex-1 text-start">حالت شیشه‌ای</span>
          <span
            class="rounded-full px-2 py-0.5 text-[10px] font-bold"
            :class="
              themeStore.glassEnabled
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            "
          >
            {{ themeStore.glassEnabled ? "فعال" : "غیرفعال" }}
          </span>
        </button>
        <p class="mt-1.5 text-[11px] text-muted-foreground">
          پس‌زمینه شفاف می‌شود و محتوای پشت پنجره از لا‌به‌لای آن دیده می‌شود.
        </p>
      </div>

      <!-- ───── حالت نوار کناری ───── -->
      <div class="border-t border-border pt-4">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">نمایش</p>
        <button
          class="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition"
          :class="
            settings.sidebarMode
              ? 'border-primary bg-accent text-accent-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
          "
          @click="settings.toggleSidebarMode"
        >
          <PanelRight class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="flex-1 text-start">حالت نوار کناری</span>
          <span
            class="rounded-full px-2 py-0.5 text-[10px] font-bold"
            :class="
              settings.sidebarMode
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            "
          >
            {{ settings.sidebarMode ? "فعال" : "غیرفعال" }}
          </span>
        </button>
        <p class="mt-1.5 text-[11px] text-muted-foreground">
          پنجره به سمت راست صفحه می‌چسبد و عرض آن ۲۶۰ پیکسل می‌شود.
        </p>
      </div>

      <!-- ───── نوار تایتل ───── -->
      <div class="border-t border-border pt-4">
        <button
          class="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition"
          :class="
            settings.titleBarVisible
              ? 'border-primary bg-accent text-accent-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
          "
          @click="settings.toggleTitleBar"
        >
          <PanelTop class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="flex-1 text-start">نمایش نوار تایتل</span>
          <span
            class="rounded-full px-2 py-0.5 text-[10px] font-bold"
            :class="
              settings.titleBarVisible
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            "
          >
            {{ settings.titleBarVisible ? "فعال" : "غیرفعال" }}
          </span>
        </button>
        <p class="mt-1.5 text-[11px] text-muted-foreground">
          نوار عنوان نمایش داده می‌شود (بدون دکمه‌ی کوچک‌کردن، برای جلوگیری از مشکل فریز).
        </p>
      </div>

      <!-- ───── اجرای خودکار هنگام روشن‌شدن سیستم ───── -->
      <div class="border-t border-border pt-4">
        <button
          class="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition"
          :class="
            settings.autostartEnabled
              ? 'border-primary bg-accent text-accent-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
          "
          @click="settings.toggleAutostart"
        >
          <Power class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="flex-1 text-start">اجرای خودکار با ویندوز</span>
          <span
            class="rounded-full px-2 py-0.5 text-[10px] font-bold"
            :class="
              settings.autostartEnabled
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            "
          >
            {{ settings.autostartEnabled ? "فعال" : "غیرفعال" }}
          </span>
        </button>
        <p class="mt-1.5 text-[11px] text-muted-foreground">
          با روشن‌شدن سیستم، برنامه به‌صورت خودکار اجرا می‌شود.
        </p>
      </div>
    </div>
  </Transition>
</template>