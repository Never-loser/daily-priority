<script setup lang="ts">
import { computed } from "vue";

interface Props {
  priority: number; // 1-5
  size?: "sm" | "md";
}
const props = withDefaults(defineProps<Props>(), { size: "md" });

const bars = computed(() =>
  Array.from({ length: 5 }, (_, i) => {
    const position = i + 1;
    const filled = position <= props.priority;
    const zone = position <= 2 ? "low" : position <= 3 ? "mid" : "high";
    const maxHeight = props.size === "sm" ? 14 : 20;
    const minHeight = props.size === "sm" ? 5 : 7;
    const height = minHeight + (position / 5) * (maxHeight - minHeight);
    return { filled, zone, height };
  }),
);

const zoneColor: Record<string, string> = {
  low: "bg-prio-low",
  mid: "bg-prio-mid",
  high: "bg-prio-high",
};
</script>

<template>
  <div
    class="inline-flex items-end gap-[2px]"
    role="img"
    :aria-label="`اولویت ${priority} از ۵`"
  >
    <span
      v-for="(bar, i) in bars"
      :key="i"
      class="w-[3px] rounded-full transition-all"
      :class="bar.filled ? zoneColor[bar.zone] : 'bg-muted'"
      :style="{ height: `${bar.height}px` }"
    />
  </div>
</template>