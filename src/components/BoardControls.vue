<template>
  <div class="board-controls relative z-20 max-w-full min-w-0 space-y-3">
    <div class="flex max-w-full min-w-0 flex-row flex-wrap items-center justify-between gap-3 md:mt-0">
      <div class="hidden min-w-0 flex-row items-center gap-3 sm:gap-4 md:flex md:gap-6">
        <BoardCategorySelector
          v-if="activeFilter !== 'my-proposals'"
          :model-value="selectedCategory"
          :label="activeCategoryLabel"
          :options="categorySelectorOptions"
          :selector-label="t(mode === 'facility' ? 'facility.chooseCategory' : 'issue.chooseProposalCategory')"
          variant="desktop-heading"
          @update:model-value="handleCategoryChange"
        />
        <h2 v-else class="shrink-0 text-xl font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50 md:text-2xl">
          {{ activeFilter === 'my-proposals' ? t('issue.myProposal') : boardTitle }}
        </h2>
      </div>

      <div class="ml-auto flex max-w-full min-w-0 shrink-0 flex-row items-center justify-end gap-1.5 sm:gap-2 md:w-auto">
        <PillSegmentedControl
          v-if="mode === 'facility' || activeFilter !== 'my-proposals'"
          v-model="statusTabModel"
          :options="statusOptions"
          class="shrink-0"
        />

        <DropdownMenu
          ref="sortMenuRef"
          panel-class="min-w-[10rem]"
          size="default"
          width="content"
        >
          <template #trigger="{ open, toggle }">
            <AppButton
              variant="toolbar"
              class="tap-target flex shrink-0 items-center justify-center rounded-full p-0"
              :active="open || sortOption !== 'latest'"
              :title="t('common.filterBoard', { board: boardTitle })"
              :aria-label="t('common.filterBoard', { board: boardTitle })"
              :aria-expanded="open"
              @click="toggleSort(toggle)"
            >
              <AppIcon name="sort" class="h-4 w-4" />
            </AppButton>
          </template>

          <template #default="{ close }">
            <div class="dropdown-label mb-1.5 whitespace-nowrap">{{ t('common.sortBy') }}</div>
            <div class="space-y-0.5">
              <button
                v-for="option in visibleSortOptions"
                :key="option.value"
                type="button"
                class="dropdown-item justify-between gap-4 whitespace-nowrap"
                :class="{ 'button-toolbar--active': option.value === sortOption }"
                @click="selectSort(option.value, close)"
              >
                <span>{{ t(option.label) }}</span>
                <SelectionMark :selected="option.value === sortOption" />
              </button>
            </div>
          </template>
        </DropdownMenu>

        <DropdownMenu
          ref="searchMenuRef"
          panel-class="w-80"
          size="search"
          :width="320"
        >
          <template #trigger="{ open, toggle }">
            <AppButton
              variant="toolbar"
              class="tap-target flex shrink-0 items-center justify-center rounded-full p-0"
              :active="Boolean(open || searchQuery)"
              :title="t('common.searchBoard', { board: boardTitle })"
              :aria-label="t('common.searchBoard', { board: boardTitle })"
              :aria-expanded="open"
              @click="toggleSearch(toggle)"
            >
              <AppIcon name="search" class="h-4 w-4" />
            </AppButton>
          </template>

          <template #default>
            <form class="relative" role="search" @submit.prevent="emit('submitSearch')">
              <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 dark:text-ink-400" />
              <input
                :value="searchQuery"
                data-autofocus
                type="search"
                autocomplete="off"
                :aria-label="t('common.searchBoard', { board: boardTitle })"
                class="field appearance-none !h-11 !py-1 !pl-9 !pr-12 text-xs placeholder:text-ink-400 dark:placeholder:text-ink-500"
                :placeholder="searchPlaceholder"
                @input="(e) => emit('update:searchQuery', (e.target as HTMLInputElement).value)"
              />
              <AppButton
                v-if="searchQuery"
                variant="toolbar"
                class="tap-target absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-0"
                :aria-label="t('common.clearSearch')"
                @click="emit('clearSearch')"
              >
                <AppIcon name="close" :size="3" />
              </AppButton>
            </form>
            <p
              v-if="searchHint || mode === 'facility'"
              class="mt-2 text-xs font-normal leading-5 text-ink-500 dark:text-ink-400"
              :class="{ 'min-h-10': mode === 'facility' }"
              aria-live="polite"
            >
              {{ searchHint }}
            </p>
          </template>
        </DropdownMenu>

        <AppButton
          v-if="createLabel"
          variant="contextual"
          class="tap-target shrink-0 p-0"
          :aria-label="createLabel"
          :title="createLabel"
          @click="$emit('create')"
        >
          <AppIcon name="plus" :size="4" :stroke-width="2.4" />
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BoardCategorySelector from '@/components/BoardCategorySelector.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import SelectionMark from '@/components/ui/atoms/SelectionMark.vue';
import DropdownMenu from '@/components/ui/molecules/DropdownMenu.vue';
import PillSegmentedControl from '@/components/ui/molecules/PillSegmentedControl.vue';
import { getDefaultIssueRouteFilter, getIssueFilterOptions, isIssueCategory } from '@/constants/categories';
import type { FacilitySortOption, IssueFilter, IssueSortOption } from '@/types';
import { useI18n } from '@/i18n';

type BoardSortOption = IssueSortOption | FacilitySortOption;

const props = defineProps<{
  mode?: 'issue' | 'facility';
  statusTab: 'active' | 'closed';
  searchQuery: string;
  searchHint: string;
  activeFilter: string;
  activeCategoryLabel: string;
  categoryOptions?: ReadonlyArray<{ label: string; value: string }>;
  createLabel?: string;
  sortOption: BoardSortOption;
}>();

const emit = defineEmits<{
  'update:statusTab': [value: 'active' | 'closed'];
  'update:searchQuery': [value: string];
  'update:sortOption': [value: BoardSortOption];
  'update:activeFilter': [value: string];
  'submitSearch': [];
  'clearSearch': [];
  create: [];
}>();
const { t } = useI18n();

const issueSortOptions = [
  { value: 'latest', label: 'common.upToDate' },
  { value: 'most-supported', label: 'common.mostSupported' },
  { value: 'ending-soon', label: 'common.endingSoon' },
] as const;

const route = useRoute();
const router = useRouter();
const facilitySortOptions = [
  { value: 'latest', label: 'common.upToDate' },
  { value: 'most-affected', label: 'common.mostPeopleEncountered' },
] as const;
const visibleSortOptions = computed(() => props.mode === 'facility'
  ? facilitySortOptions
  : props.statusTab === 'closed'
    ? issueSortOptions.filter((option) => option.value === 'latest')
    : issueSortOptions);

const boardTitle = computed(() => t(props.mode === 'facility' ? 'facility.facility' : 'issue.proposal'));
const searchPlaceholder = computed(() => t(props.mode === 'facility' ? 'common.searchForATitleOrLocation' : 'common.searchSiteWideTitles'));
const issueCategoryFilter = computed<IssueFilter>(() =>
  isIssueCategory(props.activeFilter) ? props.activeFilter : getDefaultIssueRouteFilter()
);
const selectedCategory = computed(() => props.mode === 'facility' ? props.activeFilter : issueCategoryFilter.value);
const categorySelectorOptions = computed(() => props.mode === 'facility'
  ? props.categoryOptions ?? []
  : getIssueFilterOptions());
const statusOptions = computed(() => [
  { value: 'active' as const, label: t(props.mode === 'facility' ? 'facility.processing' : 'issue.inProgress'), icon: 'list' as const, title: t('common.showStatusInBoard', { status: t(props.mode === 'facility' ? 'facility.processing' : 'issue.inProgress'), board: boardTitle.value }) },
  { value: 'closed' as const, label: t('facility.caseClosed'), icon: 'inbox' as const, title: t('common.showStatusInBoard', { status: t('facility.caseClosed'), board: boardTitle.value }) },
]);
const searchMenuRef = ref<InstanceType<typeof DropdownMenu> | null>(null);
const sortMenuRef = ref<InstanceType<typeof DropdownMenu> | null>(null);

function toggleSearch(toggle: () => void) {
  sortMenuRef.value?.close(false);
  toggle();
}

function toggleSort(toggle: () => void) {
  searchMenuRef.value?.close(false);
  toggle();
}

function selectSort(value: BoardSortOption, close: () => void) {
  close();
  emit('update:sortOption', value);
}

const statusTabModel = computed({
  get: () => props.statusTab,
  set: (value: 'active' | 'closed') => emit('update:statusTab', value),
});

async function handleCategoryChange(value: string) {
  if (value === props.activeFilter) return;
  if (props.mode === 'facility') {
    emit('update:activeFilter', value);
    return;
  }
  await router.push({
    name: 'issues',
    params: { filter: value as IssueFilter },
    query: route.query,
  });
}
</script>
