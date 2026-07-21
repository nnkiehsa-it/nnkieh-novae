<template>
  <RoutePageFrame padding="responsive">
    <div class="space-y-6 py-4">
      <header>
        <h1 class="text-2xl font-bold text-ink-950 dark:text-ink-50">{{ t('adminCenter.title') }}</h1>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-ink-500">{{ t('adminCenter.description') }}</p>
      </header>

      <div class="grid gap-3 sm:grid-cols-2" role="group" :aria-label="t('adminCenter.sections')">
        <SelectionOptionButton
          v-for="option in tabOptions"
          :key="option.value"
          :label="option.label"
          :description="option.description"
          :selected="activeTab === option.value"
          @select="setTab(option.value)"
        />
      </div>

      <CategoryWorkflowPanel
        v-if="visitedTabs.has('categories')"
        v-show="activeTab === 'categories'"
      />
      <MemberAccessPanel
        v-if="visitedTabs.has('members')"
        v-show="activeTab === 'members'"
      />
    </div>
  </RoutePageFrame>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CategoryWorkflowPanel from '@/components/admin/CategoryWorkflowPanel.vue';
import MemberAccessPanel from '@/components/admin/MemberAccessPanel.vue';
import SelectionOptionButton from '@/components/ui/molecules/SelectionOptionButton.vue';
import RoutePageFrame from '@/components/ui/organisms/RoutePageFrame.vue';
import { useI18n } from '@/i18n';

type AdministrationTab = 'categories' | 'members';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const activeTab = computed<AdministrationTab>(() => route.query.tab === 'members' ? 'members' : 'categories');
const visitedTabs = reactive(new Set<AdministrationTab>([activeTab.value]));
const tabOptions = computed(() => [
  { value: 'categories' as const, label: t('adminCenter.categoriesTabLabel'), description: t('adminCenter.categoriesTabHelp') },
  { value: 'members' as const, label: t('adminCenter.membersTabLabel'), description: t('adminCenter.membersTabHelp') },
]);

watch(activeTab, (tab) => { visitedTabs.add(tab); });

function setTab(tab: AdministrationTab) {
  if (activeTab.value === tab) return;
  void router.replace({ query: { ...route.query, tab } });
}
</script>
