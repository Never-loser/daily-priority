<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

interface Props {
  modelValue?: string | number;
  // Vue only auto-applies the core v-model modifiers (.number/.trim/.lazy) to
  // native elements. For a custom component like this one they arrive here
  // as this prop instead, and we apply them ourselves — otherwise
  // `v-model.number="hours"` (used for the timer duration fields) would
  // silently keep emitting a string instead of a number.
  modelModifiers?: { number?: boolean; trim?: boolean };
  type?: string;
  placeholder?: string;
  class?: string;
  disabled?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
  type: "text",
  modelModifiers: () => ({}),
});

const emit = defineEmits<{
  "update:modelValue": [value: string | number];
}>();

const classes = computed(() =>
  cn(
    "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
    props.class,
  ),
);

function onInput(event: Event) {
  let value: string | number = (event.target as HTMLInputElement).value;
  if (props.modelModifiers.trim) value = value.trim();
  if (props.modelModifiers.number) value = value === "" ? "" : Number(value);
  emit("update:modelValue", value);
}
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :min="min"
    :max="max"
    :step="step"
    :class="classes"
    @input="onInput"
  />
</template>
