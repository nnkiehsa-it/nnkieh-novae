const fs = require('fs');

let content = fs.readFileSync('src/components/IssueDetailsDialog.vue', 'utf8');

// Header
content = content.replace(
  '<div class="flex items-center justify-between border-b border-ink-150 dark:border-ink-800 pb-4 shrink-0 mb-4">',
  '<div class="flex items-center justify-between border-b border-ink-150 dark:border-ink-800 pb-2 md:pb-3 mb-2 md:mb-0 shrink-0">'
);

// Desktop structure
content = content.replace(
  '<!-- Desktop Double-Column Layout (Screen size md and above) -->\n          <div class="hidden md:flex w-full flex-1 min-h-0 divide-x divide-ink-200/60 dark:divide-ink-800/80 h-full mt-2">',
  '<!-- Desktop Double-Column Layout (Screen size md and above) -->\n          <div class="hidden md:flex w-full flex-1 min-h-0 divide-x divide-ink-200/60 dark:divide-ink-800/80 h-full mt-0">'
);

content = content.replace(
  '<div class="shrink-0 space-y-4 pb-1">',
  '<div class="shrink-0 space-y-2 pb-1">'
);

content = content.replace(
  '<div class="flex items-center gap-3 border-b border-ink-100 dark:border-ink-800 pb-4 text-sm">',
  '<div class="flex items-center gap-3 border-b border-ink-100 dark:border-ink-800 pb-3 text-sm">'
);

content = content.replace(
  `              <!-- Middle Scrollable Content Box -->
              <div class="flex-1 min-h-0 overflow-y-auto my-4 pr-2">
                <div class="relative overflow-hidden rounded-[1.25rem] border border-ink-200/80 bg-ink-50/80 px-5 py-5 dark:border-ink-700/80 dark:bg-ink-900/40 text-ink-800 dark:text-ink-100 font-sans max-w-none">
                  <MarkdownRenderer :content="issue.content" />
                </div>
              </div>`,
  `              <!-- Middle Scrollable Content Box -->
              <div class="flex-1 min-h-0 overflow-y-auto my-2 pr-2">
                <div class="relative py-2 text-ink-800 dark:text-ink-100 font-sans max-w-none">
                  <MarkdownRenderer :content="issue.content" />
                </div>
              </div>`
);

content = content.replace(
  `              <!-- Bottom Fixed Section -->
              <div class="shrink-0 border-t border-ink-100 dark:border-ink-800 pt-4 mt-auto space-y-4 pb-2">
                <!-- Support & Progress Panel -->
                <div v-if="issue.support_enabled" class="space-y-4">
                  <!-- Progress bar & Vote button layout (matching IssueCard) -->
                  <div class="space-y-4">
                    <div class="space-y-2">
                      <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-600 dark:text-ink-300">
                        <p>附議進度 {{ supportCount }} / {{ issue.support_goal ?? 0 }}</p>
                        <p v-if="supportRemainingLabel" class="text-xs text-ink-500 dark:text-ink-400 font-medium">
                          {{ supportRemainingLabel }}
                        </p>
                      </div>
                      <div class="relative h-2 w-full overflow-hidden rounded-full bg-ink-200/50 dark:bg-ink-800/80">
                        <div
                          class="h-full rounded-full bg-ink-900 transition-all duration-300 dark:bg-ink-100"
                          :style="supportProgressStyle"
                        ></div>
                      </div>
                    </div>
                  
                    <div class="flex w-full items-center justify-end">
                      <VoteButtons
                        class="shrink-0"
                        :issue-id="issue.id"
                        :current-user-supported="currentUserSupported"
                        :support-count="supportCount"
                        :support-closed="supportClosed"
                        @supported="emit('supported', $event)"
                      />
                    </div>
                  </div>
                </div>

                <!-- General Deadlines -->
                <div
                  :class="[
                    'text-xs text-ink-500 dark:text-ink-400 grid grid-cols-1 sm:grid-cols-2 gap-3.5',
                    issue.support_enabled ? 'border-t border-ink-100 dark:border-ink-800 pt-3.5 mt-3.5' : ''
                  ]"
                >`,
  `              <!-- Bottom Fixed Section -->
              <div class="shrink-0 border-t border-ink-100 dark:border-ink-800 pt-3 mt-auto space-y-3 pb-1">
                <!-- Support & Progress Panel -->
                <div v-if="issue.support_enabled" class="space-y-3">
                  <!-- Progress bar & Vote button single row layout -->
                  <div class="flex flex-wrap md:flex-nowrap items-center justify-between gap-3">
                    <div class="flex-1 w-full md:w-auto min-w-0 flex flex-wrap items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
                      <span>附議進度 {{ supportCount }} / {{ issue.support_goal ?? 0 }}</span>
                      <span v-if="supportRemainingLabel" class="text-xs text-ink-500 dark:text-ink-400 font-medium whitespace-nowrap">
                        ({{ supportRemainingLabel }})
                      </span>
                    </div>
                    <VoteButtons
                      class="shrink-0"
                      :issue-id="issue.id"
                      :current-user-supported="currentUserSupported"
                      :support-count="supportCount"
                      :support-closed="supportClosed"
                      @supported="emit('supported', $event)"
                    />
                  </div>
                  <div class="relative h-2 w-full overflow-hidden rounded-full bg-ink-200/50 dark:bg-ink-800/80">
                    <div
                      class="h-full rounded-full bg-ink-900 transition-all duration-300 dark:bg-ink-100"
                      :style="supportProgressStyle"
                    ></div>
                  </div>
                </div>

                <!-- General Deadlines -->
                <div
                  :class="[
                    'text-xs text-ink-500 dark:text-ink-400 flex flex-wrap gap-x-4 gap-y-2',
                    issue.support_enabled ? 'border-t border-ink-100 dark:border-ink-800 pt-3 mt-3' : ''
                  ]"
                >`
);

// Mobile Layout
content = content.replace(
  `          <!-- Mobile / Tablet Layout (Screen size < md) -->
          <div class="md:hidden flex flex-col flex-1 min-h-0 mt-4 overflow-hidden">
            <!-- Segmented Tab Bar -->
            <div class="shrink-0 mb-4 flex justify-center">`,
  `          <!-- Mobile / Tablet Layout (Screen size < md) -->
          <div class="md:hidden flex flex-col flex-1 min-h-0 mt-2 overflow-hidden">
            <!-- Segmented Tab Bar -->
            <div class="shrink-0 mb-2 flex justify-center">`
);

let mobileDetailsRegex = /<!-- Details Tab -->[\s\S]*?<!-- Comments Tab -->/m;
let mobileDetailsMatch = content.match(mobileDetailsRegex);
if (mobileDetailsMatch) {
  let newMobileDetails = `<!-- Details Tab -->
              <div v-show="activeTab === 'details'" class="flex-1 min-h-0 flex flex-col h-full">
                <!-- Scrollable Content -->
                <div class="flex-1 min-h-0 overflow-y-auto px-1 pr-2 pb-2">
                  <!-- Top Section -->
                  <div class="space-y-2 pb-1">
                    <!-- Badges -->
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="tag bg-ink-100/50 dark:bg-ink-950/50 border-ink-200 dark:border-ink-800">
                        {{ categoryLabel }}
                      </span>
                      <span class="tag shadow-sm font-semibold" :class="statusClass">
                        {{ statusLabel }}
                      </span>
                      <span
                        v-if="issue.support_enabled && issue.support_met_at"
                        class="tag border-emerald-300 bg-emerald-50/10 text-emerald-700 dark:border-emerald-700/80 dark:text-emerald-300 dark:bg-emerald-500/5 shadow-sm font-semibold"
                      >
                        已達門檻
                      </span>
                    </div>

                    <!-- Title -->
                    <h3 class="break-words text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50 leading-tight">
                      {{ issue.title }}
                    </h3>

                    <!-- Author card -->
                    <div class="flex items-center gap-2 border-b border-ink-100 dark:border-ink-800 pb-2 text-sm flex-wrap">
                      <img
                        v-if="displayPhotoUrl"
                        :src="displayPhotoUrl"
                        alt="作者頭像"
                        class="h-6 w-6 rounded-full border border-ink-200 object-cover dark:border-ink-700 shadow-sm"
                      />
                      <div
                        v-else
                        class="flex h-6 w-6 items-center justify-center rounded-full border border-ink-200 bg-ink-100 text-xs font-bold text-ink-500 dark:border-ink-700 dark:bg-ink-950 shadow-sm"
                      >
                        匿
                      </div>
                      <p class="font-medium text-ink-900 dark:text-ink-100">{{ displayAuthorName }}</p>
                      <span class="text-ink-300 dark:text-ink-700">&middot;</span>
                      <p class="text-xs text-ink-500 dark:text-ink-400">{{ createdLabel }}</p>
                    </div>
                  </div>

                  <!-- Content Box (No decoration) -->
                  <div class="py-2 text-ink-800 dark:text-ink-100 font-sans">
                    <MarkdownRenderer :content="issue.content" />
                  </div>
                </div>

                <!-- Bottom Fixed Section (Sticky Footer) -->
                <div class="shrink-0 border-t border-ink-100 dark:border-ink-800 pt-3 mt-auto space-y-3 pb-1 px-1">
                  <!-- Support progress -->
                  <div v-if="issue.support_enabled" class="space-y-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex-1 min-w-0 flex flex-wrap items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
                        <span>附議進度 {{ supportCount }} / {{ issue.support_goal ?? 0 }}</span>
                        <span v-if="supportRemainingLabel" class="text-xs text-ink-500 dark:text-ink-400 font-medium whitespace-nowrap">
                          ({{ supportRemainingLabel }})
                        </span>
                      </div>
                      <VoteButtons
                        class="shrink-0"
                        :issue-id="issue.id"
                        :current-user-supported="currentUserSupported"
                        :support-count="supportCount"
                        :support-closed="supportClosed"
                        @supported="emit('supported', $event)"
                      />
                    </div>
                    <div class="relative h-2 w-full overflow-hidden rounded-full bg-ink-200/50 dark:bg-ink-800/80">
                      <div
                        class="h-full rounded-full bg-ink-900 transition-all duration-300 dark:bg-ink-100"
                        :style="supportProgressStyle"
                      ></div>
                    </div>
                  </div>

                  <!-- General Deadlines -->
                  <div
                    :class="[
                      'text-xs text-ink-500 dark:text-ink-400 flex flex-wrap gap-x-3 gap-y-1',
                      issue.support_enabled ? 'border-t border-ink-100 dark:border-ink-800 pt-2 mt-2' : ''
                    ]"
                  >
                    <div class="flex items-center gap-1 shrink-0">
                      <span class="font-semibold text-ink-400">提案：</span>
                      <span class="font-medium text-ink-700 dark:text-ink-300">{{ createdLabel || '未定' }}</span>
                    </div>
                    <div v-if="issue.support_enabled && issue.support_deadline_at" class="flex items-center gap-1 shrink-0">
                      <span class="font-semibold text-ink-400">截止：</span>
                      <span class="font-medium text-ink-700 dark:text-ink-300">{{ supportDeadlineLabel }}</span>
                    </div>
                    <div v-if="issue.response_deadline_at" class="flex items-center gap-1 shrink-0">
                      <span class="font-semibold text-ink-400">回覆：</span>
                      <span class="font-medium text-ink-700 dark:text-ink-300">{{ responseDeadlineLabel }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Comments Tab -->`;
  
  content = content.replace(mobileDetailsRegex, newMobileDetails);
}


fs.writeFileSync('src/components/IssueDetailsDialog.vue', content);
