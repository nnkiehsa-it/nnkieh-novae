<template>
  <DropdownMenu
    class="!block w-full"
    panel-class="max-w-[calc(100vw-2rem)]"
    :width="240"
  >
    <template #trigger="{ open, toggle }">
      <IconListRow
        icon="globe"
        :label="t(currentLanguage.label)"
        :description="t('settings.changeTheInterfaceLanguage')"
        aria-haspopup="listbox"
        :aria-expanded="open"
        @click="toggle"
      >
        <template #trailing>
          <AppIcon
            name="chevron-down"
            :size="4"
            class="shrink-0 text-ink-400 transition-transform"
            :class="{ 'rotate-180': open }"
          />
        </template>
      </IconListRow>
    </template>

    <template #default="{ close }">
      <div class="dropdown-label mb-1">{{ t('settings.language') }}</div>
      <div role="listbox" :aria-label="t('settings.language')" class="space-y-0.5">
        <button
          v-for="option in languageOptions"
          :key="option.value"
          type="button"
          role="option"
          class="dropdown-item justify-between"
          :class="{ 'button-toolbar--active': locale === option.value }"
          :aria-selected="locale === option.value"
          @click="selectLanguage(option.value, close)"
        >
          <span>{{ t(option.label) }}</span>
          <SelectionMark :selected="locale === option.value" />
        </button>
      </div>
    </template>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import SelectionMark from '@/components/ui/atoms/SelectionMark.vue';
import DropdownMenu from '@/components/ui/molecules/DropdownMenu.vue';
import IconListRow from '@/components/ui/molecules/IconListRow.vue';
import { useI18n, type AppLocale } from '@/i18n';

const { locale, setLocale, t } = useI18n();
const languageOptions: Array<{ label: string; value: AppLocale }> = [
  { label: 'settings.traditionalChinese', value: 'zh-TW' },
  { label: 'settings.english', value: 'en' },
];
const currentLanguage = computed(
  () => languageOptions.find((option) => option.value === locale.value) ?? languageOptions[0],
);

function selectLanguage(value: AppLocale, close: () => void) {
  setLocale(value);
  close();
}
</script>
