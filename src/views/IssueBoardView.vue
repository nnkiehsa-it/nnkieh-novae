<template>
  <RoutePageFrame as="div" layout="fill">
    <PageLoadFailure
      v-if="sessionLoadingHasProblem"
      :title="sessionProblemTitle"
      :description="sessionProblemDescription"
      :retry-disabled="!sessionOnline"
      @retry="reloadPage"
    />

    <div
      v-else-if="sessionLoading"
      class="flex min-h-0 flex-1 flex-col gap-5"
      :aria-label="t('issue.loadingProposals')"
      aria-busy="true"
    >
      <div class="board-controls relative z-20 space-y-3">
        <div class="flex flex-row items-center justify-between gap-3 md:mt-0">
          <SkeletonBlock class="hidden h-8 w-32 rounded md:block" />
          <div
            class="flex w-full shrink-0 items-center justify-end gap-1.5 sm:gap-2 md:w-auto"
          >
            <SkeletonBlock class="h-8 w-[9.375rem] rounded-full" />
            <SkeletonBlock class="h-8 w-8 rounded-full md:h-9 md:w-9" />
            <SkeletonBlock class="h-8 w-8 rounded-full md:h-9 md:w-9" />
            <SkeletonBlock class="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
      <div
        class="route-scroll-through scroll-shadow-bleed scrollbar-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        <IssueBoardTable :issues="[]" :loading="true" error="" />
      </div>
    </div>

    <IssueBoard
      v-else-if="isAllowedUser"
      :is-form-open="isFormOpen"
      @toggle-form="toggleForm"
    />

    <div v-else class="sr-only" role="status">
      {{ t("auth.redirectingToSignIn") }}
    </div>
  </RoutePageFrame>
</template>

<script setup lang="ts">
import RoutePageFrame from "@/components/ui/organisms/RoutePageFrame.vue";
import SkeletonBlock from "@/components/ui/atoms/SkeletonBlock.vue";
import { computed, ref } from "vue";
import { useI18n } from "@/i18n";
import IssueBoard from "@/components/IssueBoard.vue";
import IssueBoardTable from "@/components/IssueBoardTable.vue";
import PageLoadFailure from "@/components/ui/molecules/PageLoadFailure.vue";
import { useSession } from "@/composables/useSession";
import { useLoadingTimeout } from "@/composables/useLoadingTimeout";
import { resetAppConnection } from "@/lib/reconnect";

const { t } = useI18n();
const { initialized, isAllowedUser, loading } = useSession();
const sessionLoading = computed(() => loading.value || !initialized.value);
const {
  hasProblem: sessionLoadingHasProblem,
  isOnline: sessionOnline,
  problemDescription: sessionProblemDescription,
  problemTitle: sessionProblemTitle,
} = useLoadingTimeout(sessionLoading, 5_000);
const isFormOpen = ref(false);

function toggleForm() {
  isFormOpen.value = !isFormOpen.value;
}

async function reloadPage() {
  await resetAppConnection();
  window.location.reload();
}
</script>
