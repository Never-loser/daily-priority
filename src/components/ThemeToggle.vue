<script setup lang="ts">
import { computed } from "vue";
import { useThemeStore } from "@/stores/theme";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun } from "lucide-vue-next";

const theme = useThemeStore();
const isDark = computed({
  get: () => theme.theme === "dark",
  set: () => theme.toggle(),
});
</script>

<template>
  <div class="flex items-center gap-2">
    <Sun class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    <Switch v-model="isDark" aria-label="تغییر حالت تیره و روشن" />
    <Moon class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
  </div>
</template>
