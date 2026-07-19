<template>
  <div>
    <label :for="inputId" class="field-label">{{ t(label) }}</label>
    <input
      :id="inputId"
      v-model.number="value"
      class="field mt-1.5"
      type="number"
      inputmode="numeric"
      min="1"
      step="1"
      :required="required"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n';

const value = defineModel<number | null>({ required: true });
withDefaults(defineProps<{ inputId: string; label: string; required?: boolean }>(), { required: true });
const { t } = useI18n();
</script>
