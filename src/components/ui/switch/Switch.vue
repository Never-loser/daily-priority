<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

interface Props {
  modelValue: boolean;
  class?: string;
  ariaLabel?: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();

const track = computed(() =>
  cn(
    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    props.modelValue ? "bg-primary" : "bg-muted",
    props.class,
  ),
);
const thumb = computed(() =>
  cn(
    "absolute top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-all",
    // Logical start/end (not left/right) so the thumb lands on the correct
    // side automatically under dir="rtl" without any extra branching.
    props.modelValue ? "end-0.5" : "start-0.5",
  ),
);
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="ariaLabel"
    :class="track"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span :class="thumb" />
  </button>
</template>
