<template>
  <RoutePageFrame as="section" bleed layout="fill" class="entry-composer-page">
    <IssueComposer
      :category="category"
      :category-label="categoryLabel"
      @close="returnToList"
      @submitted="openSubmittedIssue"
    />
  </RoutePageFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import IssueComposer from '@/components/IssueComposer.vue';
import RoutePageFrame from '@/components/ui/organisms/RoutePageFrame.vue';
import { getDefaultIssueRouteFilter, getIssueCategoryLabel, isIssueCategory } from '@/constants/categories';
import type { IssueRecord, WritableIssueCategory } from '@/types';

const route = useRoute();
const router = useRouter();
const category = computed<WritableIssueCategory>(() => {
  const value = Array.isArray(route.params.filter) ? route.params.filter[0] : route.params.filter;
  return isIssueCategory(value) ? value : getDefaultIssueRouteFilter() as WritableIssueCategory;
});
const categoryLabel = computed(() => getIssueCategoryLabel(category.value));

function returnToList() {
  void router.replace({ name: 'issues', params: { filter: category.value } });
}

function openSubmittedIssue(issue: IssueRecord) {
  void router.replace({
    name: 'issue-detail',
    params: { filter: issue.category, issueId: issue.id },
  });
}
</script>
