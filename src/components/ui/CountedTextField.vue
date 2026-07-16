<template>
  <div class="shrink-0 space-y-1.5">
    <label :for="inputId" class="field-label">{{ label }}</label>
    <input
      :id="inputId"
      v-model="value"
      autocomplete="off"
      class="field py-3 text-base"
      :maxlength="maxLength"
      :placeholder="placeholder"
      :disabled="disabled"
      :data-autofocus="autofocus ? '' : undefined"
      :required="required"
    />
    <div class="flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
      <span>{{ helperText }}</span>
      <span class="font-medium" :class="{ 'text-error': value.length > warningLength }">
        {{ value.length }} / {{ maxLength }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
const value = defineModel<string>({ required: true });

withDefaults(defineProps<{
  autofocus?: boolean;
  disabled?: boolean;
  helperText?: string;
  inputId: string;
  label: string;
  maxLength: number;
  placeholder?: string;
  required?: boolean;
  warningLength: number;
}>(), {
  autofocus: false,
  disabled: false,
  helperText: '必填',
  placeholder: '',
  required: false,
});
</script>
