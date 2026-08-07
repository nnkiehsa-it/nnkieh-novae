<template>
  <RoutePageFrame padding="responsive">
    <div class="space-y-6 py-4">
      <header>
        <h1 class="text-2xl font-bold text-ink-950 dark:text-ink-50">{{ t('adminCenter.title') }}</h1>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-ink-500">{{ t('adminCenter.description') }}</p>
      </header>

      <div class="administration-tabs">
        <div
          ref="tabListRef"
          class="flex gap-6 overflow-x-auto border-b border-ink-200 dark:border-ink-800"
          role="tablist"
          :aria-label="t('adminCenter.sections')"
          @scroll.passive="updateTabScrollCues"
        >
          <AppButton
            v-for="option in tabOptions"
            :id="`${option.value}-settings-tab`"
            :key="option.value"
            variant="toolbar"
            role="tab"
            class="min-h-12 shrink-0 rounded-none border-b-2 px-1 text-sm"
            :class="activeTab === option.value
              ? 'border-ink-900 text-ink-950 dark:border-ink-100 dark:text-ink-50'
              : 'border-transparent text-ink-500'"
            :aria-selected="activeTab === option.value"
            :aria-controls="`${option.value}-settings-panel`"
            @click="setTab(option.value)"
          >
            {{ option.label }}
          </AppButton>
        </div>
        <span v-if="canScrollTabsLeft" class="administration-tabs__scroll-cue administration-tabs__scroll-cue--left" aria-hidden="true" />
        <span v-if="canScrollTabsRight" class="administration-tabs__scroll-cue administration-tabs__scroll-cue--right" aria-hidden="true" />
      </div>

      <CategoryWorkflowPanel
        v-if="visitedTabs.has('categories')"
        v-show="activeTab === 'categories'"
        id="categories-settings-panel"
        role="tabpanel"
        aria-labelledby="categories-settings-tab"
      />
      <MemberAccessPanel
        v-if="visitedTabs.has('members')"
        v-show="activeTab === 'members'"
        id="members-settings-panel"
        role="tabpanel"
        aria-labelledby="members-settings-tab"
      />
    </div>
  </RoutePageFrame>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core';
import { computed, nextTick, onMounted, reactive, ref, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CategoryWorkflowPanel from '@/components/admin/CategoryWorkflowPanel.vue';
import MemberAccessPanel from '@/components/admin/MemberAccessPanel.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import RoutePageFrame from '@/components/ui/organisms/RoutePageFrame.vue';
import { useI18n } from '@/i18n';

type AdministrationTab = 'categories' | 'members';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const tabListRef = useTemplateRef<HTMLElement>('tabListRef');
const canScrollTabsLeft = ref(false);
const canScrollTabsRight = ref(false);
const activeTab = computed<AdministrationTab>(() => route.query.tab === 'members' ? 'members' : 'categories');
const visitedTabs = reactive(new Set<AdministrationTab>([activeTab.value]));
const tabOptions = computed(() => [
  { value: 'categories' as const, label: t('adminCenter.categoriesTabLabel') },
  { value: 'members' as const, label: t('adminCenter.membersTabLabel') },
]);

watch(activeTab, (tab) => { visitedTabs.add(tab); });
useResizeObserver(tabListRef, updateTabScrollCues);

onMounted(() => {
  void nextTick(updateTabScrollCues);
});

function updateTabScrollCues() {
  const tabList = tabListRef.value;
  if (!tabList) return;
  const edgeTolerance = 1;
  canScrollTabsLeft.value = tabList.scrollLeft > edgeTolerance;
  canScrollTabsRight.value = tabList.scrollLeft + tabList.clientWidth < tabList.scrollWidth - edgeTolerance;
}

function setTab(tab: AdministrationTab) {
  if (activeTab.value === tab) return;
  void router.replace({ query: { ...route.query, tab } });
}
</script>
