import assert from 'node:assert/strict';
import test from 'node:test';
import { read } from './helpers.mjs';

test('entry and comment limits are enforced across UI, Edge, and a new migration', async () => {
  const frontendLimits = await read('src/constants/input-limits.ts');
  const backendValidation = await read('supabase/functions/backendAction/validation.ts');
  const databaseLimits = await read('supabase/migrations/202607150002_input_length_limits.sql');
  const commentComposer = await read('src/components/CommentComposer.vue');
  const commentItem = await read('src/components/CommentItem.vue');
  const commentThread = await read('src/components/CommentThreadPanel.vue');
  const detailShell = await read('src/components/ui/organisms/DetailPageShell.vue');
  const issueComposer = await read('src/components/IssueComposer.vue');
  const announcementComposer = await read('src/components/AnnouncementComposer.vue');
  const facilityComposer = await read('src/components/FacilityComposer.vue');
  const composerShell = await read('src/components/ui/organisms/EntryComposerShell.vue');
  const countedField = await read('src/components/ui/molecules/CountedTextField.vue');
  const feedbackBar = await read('src/components/ActionFeedbackBar.vue');
  const responsiveStyles = await read('src/styles/responsive.css');
  const baseStyles = await read('src/styles/base.css');
  const primitives = await read('src/styles/primitives.css');

  assert.match(frontendLimits, /title: 30/u);
  assert.match(frontendLimits, /content: 1_000/u);
  assert.match(frontendLimits, /comment: 70/u);
  assert.match(backendValidation, /requiredMediaContent/u);
  assert.match(backendValidation, /optionalMediaContent/u);
  assert.match(databaseLimits, /visible_media_text_length/u);
  assert.match(databaseLimits, /between 1 and 30/u);
  assert.match(databaseLimits, /> 1000/u);
  assert.match(databaseLimits, /> 70/u);
  assert.doesNotMatch(commentComposer, /MarkdownRenderer|showPreview|預覽留言/u);
  assert.match(commentItem, /plain-text/u);
  assert.doesNotMatch(commentThread, /第一則留言會出現在這裡/u);
  assert.match(detailShell, /label: t\('comments\.countComments'/u);
  assert.match(primitives, /padding-bottom: calc\(var\(--app-bottom-nav-height\) \+ 1rem\)/u);
  assert.match(responsiveStyles, /padding-left: max\(var\(--dialog-safe-padding, 1rem\), env\(safe-area-inset-left\)\)/u);
  assert.match(responsiveStyles, /padding-right: max\(var\(--dialog-safe-padding, 1rem\), env\(safe-area-inset-right\)\)/u);
  assert.match(composerShell, /entry-composer__scroll/u);
  assert.match(responsiveStyles, /\.entry-composer__scroll \{[\s\S]*margin-inline: 0;[\s\S]*padding-inline: 0\.5rem;/u);
  assert.match(responsiveStyles, /\.entry-composer__footer \{/u);
  assert.match(responsiveStyles, /\.entry-composer__actions \{/u);
  assert.match(responsiveStyles, /\.entry-composer__action \{[\s\S]*height: var\(--control-height\);[\s\S]*font-weight: 600;/u);
  [issueComposer, announcementComposer, facilityComposer].forEach((composer) => {
    assert.match(composer, /EntryComposerShell/u);
    assert.doesNotMatch(composer, /entry-composer__action button-contextual/u);
  });
  assert.match(composerShell, /CountedTextField/u);
  assert.match(composerShell, /MarkdownImageEditor/u);
  assert.match(composerShell, /class="entry-composer__footer"/u);
  assert.match(composerShell, /class="entry-composer__actions"/u);
  assert.match(composerShell, /<SurfacePanel[^>]*class="entry-composer-page__surface/u);
  assert.match(composerShell, /onBeforeRouteLeave[\s\S]*discardDialogOpen/u);
  assert.doesNotMatch(composerShell, /\bautofocus\b/u);
  assert.equal((composerShell.match(/<AppButton[\s\S]*?variant="secondary"[\s\S]*?class="entry-composer__action"/gu) ?? []).length, 2);
  assert.match(countedField, /v-model="value"/u);
  assert.match(composerShell, /min-h-\[220px\]/u);
  assert.match(composerShell, /editor-class="flex-1 min-h-\[180px\]"/u);
  assert.match(feedbackBar, /action-feedback-card[\s\S]*min-h-14 w-full/u);
  assert.match(baseStyles, /\.action-feedback-viewport \{[\s\S]*padding-left: max\(var\(--app-viewport-gutter\), env\(safe-area-inset-left\)\);[\s\S]*padding-right: max\(var\(--app-viewport-gutter\), env\(safe-area-inset-right\)\)/u);
  assert.match(baseStyles, /@media \(max-width: 767px\) \{[\s\S]*body\.dialog-open \.action-feedback-viewport \{[\s\S]*top: calc\(env\(safe-area-inset-top\) \+ 6\.75rem\)/u);
});

test('primary navigation keeps desktop chrome and persistent mobile navigation', async () => {
  const app = await read('src/App.vue');
  const appShell = await read('src/components/AppShell.vue');
  const mobileHeader = await read('src/components/app-shell/AppMobileHeader.vue');
  const mobileBottomNav = await read('src/components/app-shell/AppMobileBottomNav.vue');
  const settingsPanel = await read('src/components/SettingsPanelContent.vue');
  const router = await read('src/router/index.ts');
  const defaultRoute = await read('src/router/default-route.ts');
  const featureAccess = await read('src/lib/feature-access.ts');
  const detailShell = await read('src/components/ui/organisms/DetailPageShell.vue');
  const detailSkeleton = await read('src/components/ui/organisms/SkeletonDetail.vue');
  const issueBoard = await read('src/components/IssueBoard.vue');
  const issueBoardView = await read('src/views/IssueBoardView.vue');
  const facilitiesView = await read('src/views/FacilitiesView.vue');
  const announcementsView = await read('src/views/AnnouncementsView.vue');
  const routeComponents = await read('src/router/route-components.ts');
  const hierarchy = await read('src/router/navigation-hierarchy.ts');
  const notificationNavigation = await read('src/composables/useNotificationNavigation.ts');
  const baseStyles = await read('src/styles/base.css');
  const navigationStyles = await read('src/styles/navigation.css');
  const primitives = await read('src/styles/primitives.css');
  const responsiveStyles = await read('src/styles/responsive.css');

  assert.doesNotMatch(app, /Transition name="page-content"/u);
  assert.doesNotMatch(app, /flex-1 overflow-x-hidden/u);
  assert.match(appShell, /app-main-content relative flex flex-1 flex-col overflow-auto/u);
  assert.match(appShell, /<AppMobileHeader[\s\S]*<ViewportFrame as="main"[\s\S]*<slot \/>/u);
  assert.match(issueBoard, /overflow-auto overscroll-contain/u);
  assert.match(issueBoard, /route-scroll-through[^"]*overflow-auto[\s\S]*<BoardControls[\s\S]*<ContentListState/u);
  assert.match(issueBoardView, /v-else-if="sessionLoading"[\s\S]*route-scroll-through[^"]*overflow-auto[\s\S]*board-controls[\s\S]*<IssueBoardTable/u);
  // Session skeleton and IssueBoard must be exclusive; concurrent mount leaves residual card shadows.
  assert.match(issueBoardView, /<IssueBoard[\s\S]*v-else-if="isAllowedUser"/u);
  assert.doesNotMatch(issueBoardView, /<IssueBoard[\s\S]*v-if="isAllowedUser"/u);
  assert.match(facilitiesView, /route-scroll-through[^"]*overflow-auto[\s\S]*<BoardControls[\s\S]*<ContentListState/u);
  assert.match(announcementsView, /route-scroll-through[^"]*overflow-auto[\s\S]*announcement\.newAnnouncement[\s\S]*<ContentListState/u);
  assert.match(announcementsView, /scrollRoot: announcementScrollRef/u);
  assert.match(app, /requestIdleCallback/u);
  assert.match(app, /preloadPrimaryRouteComponents/u);
  assert.match(appShell, /@pointerover\.capture="handleNavigationIntent"/u);
  assert.match(appShell, /preloadRoutePath/u);
  assert.match(routeComponents, /preloadRequests/u);
  assert.match(routeComponents, /for \(const routeName of routeNames\)/u);
  assert.match(routeComponents, /loadIssueComposerView[\s\S]*loadFacilityComposerView[\s\S]*loadAnnouncementComposerView/u);
  assert.match(routeComponents, /\/facilities\/new[\s\S]*facility-create[\s\S]*\/announcements\/new[\s\S]*announcement-create/u);
  assert.match(defaultRoute, /isRouteEnabledByFeatures/u);
  assert.match(featureAccess, /issue-create[\s\S]*facility-create/u);
  assert.match(appShell, /isComposerRoute[\s\S]*showAuthenticatedChrome\.value && !isComposerRoute\.value/u);
  assert.doesNotMatch(responsiveStyles, /\.page-content-(?:enter|leave)/u);
  assert.match(app, /class="route-stage[^"\n]*h-full[\s\S]*<Transition :name="routeTransitionName">/u);
  assert.match(app, /getRouteNavigationDepth[\s\S]*route-forward[\s\S]*route-back/u);
  assert.doesNotMatch(app, /mode="out-in"/u);
  assert.match(app, /class="route-content-frame[^"\n]*flex h-full[^"\n]*flex-col/u);
  assert.match(appShell, /:data-bottom-nav="showMobileBottomNavigation/u);
  assert.match(appShell, /:data-sidebar="showAuthenticatedChrome/u);
  assert.match(appShell, /<Transition name="mobile-nav">[\s\S]*v-if="showMobileBottomNavigation"/u);
  assert.match(appShell, /issuesEnabled\.value \? \{[\s\S]*facilitiesEnabled\.value \? \{/u);
  assert.match(mobileBottomNav, /gridTemplateColumns: `repeat\(\$\{items\.length \+ 2\}/u);
  assert.match(settingsPanel, /v-if="issuesEnabled"[\s\S]*to="\/issues\/my-proposals"/u);
  assert.match(featureAccess, /features\.issuesEnabled[\s\S]*features\.facilitiesEnabled[\s\S]*name: 'announcements'/u);
  assert.match(router, /isFeatureRouteEnabled\(to\.name\)[\s\S]*getDefaultAuthenticatedRoute/u);
  assert.doesNotMatch(appShell, /getRouteNavigationDepth|data-navigation-depth/u);
  assert.match(appShell, /showAuthenticatedChrome = computed\(\(\) => isAllowedUser\.value && !roleLoading\.value\)/u);
  assert.match(appShell, /showMobileBottomNavigation = computed\(\(\) => showAuthenticatedChrome\.value && !isComposerRoute\.value\)/u);
  assert.match(app, /roleLoading[\s\S]*publicOnly[\s\S]*ensureCategoryCatalog|publicOnly[\s\S]*roleLoading[\s\S]*ensureCategoryCatalog/u);
  assert.match(router, /publicOnly && user\.value[\s\S]*waitForRoleReady[\s\S]*setupCompleted/u);
  assert.match(baseStyles, /\.route-content-frame \{[\s\S]*background-color: rgb\(var\(--color-page-background\)\)/u);
  assert.match(baseStyles, /\.route-stage \{[\s\S]*display: grid;[\s\S]*isolation: isolate/u);
  assert.doesNotMatch(baseStyles, /\.route-stage \{[\s\S]{0,120}(?:contain: paint|overflow: hidden)/u);
  assert.match(baseStyles, /\.route-content-frame \{[\s\S]*grid-area: 1 \/ 1/u);
  assert.doesNotMatch(baseStyles, /\.route-content-frame \{[\s\S]{0,200}(?:backface-visibility|transform-origin)/u);
  assert.doesNotMatch(baseStyles, /\.app-root\[data-bottom-nav='true'\] \.route-content-frame \{[\s\S]*padding-bottom/u);
  assert.match(primitives, /\.route-page-frame--flow,[\s\S]*\.route-page-frame--bottom-safe \{\s*padding-bottom: max\(0px, calc\(var\(--app-bottom-nav-height\) \+ var\(--app-bottom-nav-gap\) - 0\.375rem\)\);/u);
  assert.match(primitives, /\.route-scroll-through \{[\s\S]*scroll-padding-bottom: calc\(var\(--app-bottom-nav-height\) \+ 1rem\)/u);
  assert.match(issueBoard, /route-scroll-through[\s\S]*overflow-auto/u);
  assert.match(facilitiesView, /route-scroll-through[\s\S]*overflow-auto/u);
  assert.doesNotMatch(baseStyles, /\.app-root\[data-bottom-nav='true'\] \.app-main-content \{[\s\S]{0,160}calc\(var\(--app-bottom-nav-height\) \+ 1rem\)/u);
  assert.match(baseStyles, /\.route-fade-enter-active,[\s\S]*\.route-forward-enter-active,[\s\S]*transition: opacity 380ms/u);
  assert.match(baseStyles, /\.route-fade-leave-active,[\s\S]*\.route-forward-leave-active,[\s\S]*transition: opacity 280ms/u);
  assert.doesNotMatch(baseStyles, /\.route-(?:fade|forward|back)-(?:enter|leave)-active[\s\S]{0,220}position: absolute/u);
  assert.match(baseStyles, /\.route-fade-enter-from,[\s\S]*\.route-back-leave-to \{[\s\S]*opacity: 0;/u);
  assert.match(baseStyles, /\.route-forward-enter-from,[\s\S]*\.route-back-enter-from,[\s\S]*opacity: 0/u);
  assert.doesNotMatch(baseStyles, /route-(?:fade|forward|back)[\s\S]{0,180}inset-inline-start/u);
  assert.doesNotMatch(baseStyles, /route-(?:swap|push|pop)|route-(?:fade|forward|back)[\s\S]{0,180}transform/u);
  assert.doesNotMatch(mobileBottomNav, /indicatorStyle|translate3d|getBoundingClientRect|setNavElement/u);
  assert.match(navigationStyles, /\.app-bottom-nav__item--active \{[\s\S]*bg-ink-100\/90[\s\S]*shadow-control/u);
  assert.match(baseStyles, /\.app-root\[data-sidebar='false'\] \.app-main-content/u);
  assert.match(appShell, /<ViewportFrame as="main" class="flex min-h-0 flex-1 flex-col">/u);
  assert.match(navigationStyles, /\.mobile-nav-enter-from,[\s\S]*translate3d\(0, 18px, 0\) scale\(0\.96\)/u);
  assert.match(hierarchy, /name === 'issue-detail' && isMyProposals[\s\S]*NESTED_DETAIL_NAVIGATION_DEPTH/u);
  assert.match(hierarchy, /state\?\.navigationOrigin !== 'notifications'[\s\S]*router\.back\(\)/u);
  assert.match(notificationNavigation, /state: NOTIFICATION_NAVIGATION_STATE/u);
  assert.match(detailShell, /<SurfacePanel[\s\S]{0,120}v-if="isDesktopViewport"[\s\S]{0,120}as="article"[\s\S]{0,120}class="hidden/u);
  assert.match(detailShell, /<section class="h-full min-h-0[\s\S]*v-else[\s\S]*class="flex h-full min-h-0/u);
  assert.match(detailSkeleton, /<div\s+class="h-full min-h-0[\s\S]*v-else[\s\S]*class="flex h-full min-h-0/u);
  assert.doesNotMatch(detailShell, /100dvh-var\(--app-header-height\)/u);
  assert.doesNotMatch(detailSkeleton, /100dvh-var\(--app-header-height\)/u);
  assert.doesNotMatch(detailShell, /v-else[\s\S]{0,240}pb-\[5px\]|shrink-0 px-0 pb-2/u);
  assert.doesNotMatch(detailSkeleton, /v-else[\s\S]{0,240}pb-\[5px\]/u);
  assert.match(mobileHeader, /<AppButton[\s\S]{0,120}variant="icon"[\s\S]{0,120}class="app-header__back/u);
  assert.match(mobileHeader, /app-header__back-slot[\s\S]*app-header__back-slot--visible/u);
  assert.doesNotMatch(mobileHeader, /<AppButton\s+v-if="showBackButton"/u);
  assert.doesNotMatch(mobileHeader, /header-title|`title:|`category:/u);
  assert.match(baseStyles, /\.app-header__back \{[\s\S]*height: var\(--tap-target\);[\s\S]*min-width: var\(--tap-target\);[\s\S]*width: var\(--tap-target\)/u);
  assert.match(navigationStyles, /\.app-header__back-slot \{[\s\S]*width: 0;[\s\S]*opacity: 0;[\s\S]*width var\(--motion-duration-panel\) var\(--motion-ease-spring\)/u);
  assert.match(navigationStyles, /\.app-header__back-slot--visible \{[\s\S]*width: var\(--tap-target\);[\s\S]*margin-right: 0\.5rem;[\s\S]*opacity: 1;/u);
  assert.match(baseStyles, /\.app-root\[data-bottom-nav='true'\] \.app-main-content \{\s*padding-bottom: 0;/u);
  assert.match(detailShell, /detail-tab-stage[\s\S]*<Transition name="detail-tab">/u);
  assert.doesNotMatch(detailShell, /detailTabTransitionName/u);
  assert.match(responsiveStyles, /\.detail-tab-enter-active,[\s\S]*opacity var\(--motion-duration\)/u);
  assert.doesNotMatch(responsiveStyles, /detail-tab[\s\S]{0,180}translateX/u);
  assert.match(baseStyles, /@media \(max-width: 767px\) \{[\s\S]*--app-header-height: 3rem/u);
  assert.doesNotMatch(detailShell, /v-else[\s\S]{0,120}class="panel/u);
  assert.doesNotMatch(detailSkeleton, /h-7 w-1\/2|h-6 w-1\/2/u);
  assert.match(responsiveStyles, /\.board-controls \{[\s\S]*padding-top: 0\.5rem/u);
});

test('proposals, announcements, and facilities share list cards and detail panels', async () => {
  const listComponents = await Promise.all([
    read('src/components/IssueBoardTable.vue'),
    read('src/components/AnnouncementTable.vue'),
    read('src/components/FacilityTable.vue'),
  ]);
  const rowComponents = await Promise.all([
    read('src/components/IssueTableRow.vue'),
    read('src/components/AnnouncementTableRow.vue'),
    read('src/components/FacilityTableRow.vue'),
  ]);
  const detailPanels = await Promise.all([
    read('src/components/IssueDetailPagePanel.vue'),
    read('src/components/AnnouncementDetailPagePanel.vue'),
    read('src/components/FacilityDetailPagePanel.vue'),
  ]);
  const issueDetailPanel = detailPanels[0];
  const issueTableRow = rowComponents[0];
  const cardCollection = await read('src/components/ui/organisms/ContentCardCollection.vue');
  const cardShell = await read('src/components/ui/organisms/ContentCardShell.vue');
  const cardSkeleton = await read('src/components/ui/organisms/ContentCardSkeleton.vue');
  const detailPagePanel = await read('src/components/ContentDetailPagePanel.vue');
  const detailActionGroup = await read('src/components/ui/molecules/DetailActionGroup.vue');
  const detailActionComponents = await Promise.all([
    read('src/components/IssueDetailSupportFooter.vue'),
    read('src/components/AnnouncementDetailActions.vue'),
    read('src/components/FacilityDetailActions.vue'),
  ]);
  const announcementDetailView = await read('src/views/AnnouncementDetailView.vue');
  const announcementDetailFlow = await read('src/composables/useAnnouncementDetail.ts');
  const detailRouteQuery = await read('src/composables/useDetailRouteQuery.ts');
  const shareUrl = await read('src/composables/useShareUrl.ts');
  const issueNotice = await read('src/lib/issue-notice.ts');
  assert.match(issueDetailPanel, /:notice-content="issueNotice\?\.content"[\s\S]*getIssueNotice/u);
  assert.match(issueTableRow, /ContentNoticePanel[\s\S]*v-if="issueNoticeSummary"[\s\S]*issueNoticeSummary\.content/u);
  assert.match(issueTableRow, /v-if="issue\.support_enabled && !issueNoticeSummary"/u);
  assert.match(issueTableRow, /stripMarkdownImages\(notice\.content\)[\s\S]*statusLabel\.value/u);
  assert.match(issueNotice, /isClosedIssueStatus[\s\S]*review-rejected[\s\S]*tone: 'error'[\s\S]*tone: 'success'/u);
  const statuses = await read('src/constants/statuses.ts');
  const contentListState = await read('src/components/ui/organisms/ContentListState.vue');
  const contentListRuntime = await read('src/composables/useContentListRuntime.ts');
  const contentListConsumers = await Promise.all([
    read('src/components/IssueBoard.vue'),
    read('src/views/AnnouncementsView.vue'),
    read('src/views/FacilitiesView.vue'),
  ]);

  listComponents.forEach((component) => assert.match(component, /ContentCardCollection/u));
  listComponents.forEach((component) => assert.match(component, /ContentCardSkeleton/u));
  rowComponents.forEach((component) => assert.match(component, /ContentCardShell/u));
  detailPanels.forEach((component) => assert.match(component, /ContentDetailPagePanel/u));
  assert.match(issueDetailPanel, /:accessible="commentsReadable"/u);
  assert.match(issueDetailPanel, /const commentsReadable = commentsAllowedForStatus/u);
  assert.doesNotMatch(issueDetailPanel, /const commentsReadable = computed/u);
  detailActionComponents.forEach((component) => assert.match(component, /DetailActionGroup/u));
  contentListConsumers.forEach((component) => {
    assert.match(component, /ContentListState/u);
    assert.match(component, /useContentListRuntime/u);
  });
  assert.match(cardCollection, /issue-card-grid/u);
  assert.match(cardShell, /issue-card[\s\S]*surface-card[\s\S]*list-row-trigger/u);
  assert.match(cardSkeleton, /count\?: number[\s\S]*count: 2/u);
  assert.match(cardSkeleton, /--skeleton-enter-index/u);
  assert.match(cardSkeleton, /<SurfacePanel[\s\S]*class="issue-card"[\s\S]*<div[\s\S]*class="skeleton-card"/u);
  assert.doesNotMatch(cardSkeleton, /<SurfacePanel(?:(?!>)[\s\S])*skeleton-card/u);
  assert.match(cardSkeleton, /<header[\s\S]*showAuthor[\s\S]*supplement[\s\S]*<footer/u);
  assert.match(contentListState, /:data-panel-key="panelKey"/u);
  assert.doesNotMatch(contentListState, /:key="panelKey"/u);
  assert.match(contentListState, /PageLoadFailure/u);
  assert.match(contentListState, /EmptyStatePanel/u);
  assert.match(contentListState, /FeedLoadMoreControl/u);
  assert.match(contentListRuntime, /useMinimumLoading/u);
  assert.match(contentListRuntime, /useLoadingTimeout/u);
  assert.match(contentListRuntime, /useInfiniteScroll/u);
  assert.match(contentListRuntime, /registerActiveNavigationRefreshHandler/u);
  assert.match(detailPagePanel, /DetailPageShell/u);
  assert.match(detailPagePanel, /ContentDetailBody/u);
  assert.match(detailActionGroup, /DetailActionButton/u);
  assert.match(detailActionGroup, /OperationTimeList/u);
  assert.match(announcementDetailView, /useAnnouncementDetail/u);
  assert.doesNotMatch(announcementDetailView, /fetchAnnouncementRecordById|subscribeContentRealtimeEvents/u);
  assert.match(announcementDetailFlow, /fetchAnnouncementRecordById/u);
  assert.match(announcementDetailFlow, /subscribeContentRealtimeEvents/u);
  assert.match(detailRouteQuery, /focusCommentId/u);
  assert.match(detailRouteQuery, /initialTab/u);
  assert.match(shareUrl, /copyRouteUrl/u);
  assert.match(statuses, /FACILITY_STATUS_LABELS/u);
  assert.match(statuses, /isFacilityClosed/u);
});

test('frontend localization follows the first-visit system language and remains regression-checked', async () => {
  const main = await read('src/main.ts');
  const i18n = await read('src/i18n/index.ts');
  const settings = await read('src/components/SettingsPanelContent.vue');
  const languageSelector = await read('src/components/LanguageSelector.vue');
  const setup = await read('src/views/SetupView.vue');
  const documentTitle = await read('src/composables/useDocumentTitle.ts');
  const issueSearch = await read('src/composables/useIssueSearch.ts');
  const pushPermissionPrompt = await read('src/components/PushPermissionPromptDialog.vue');
  const packageJson = JSON.parse(await read('package.json'));
  const i18nCheck = await read('scripts/check-i18n.mjs');

  assert.ok(main.indexOf('initializeI18n()') < main.indexOf('createApp(App)'));
  assert.match(i18n, /LOCALE_STORAGE_KEY = 'novae:locale'/u);
  assert.match(i18n, /storedLocale \?\? detectSystemLocale\(\)/u);
  assert.match(i18n, /navigator\.languages\?\.length[\s\S]*normalizeLocale\(languages\[0\]\)/u);
  assert.match(i18n, /document\.documentElement\.lang = locale/u);
  assert.doesNotMatch(i18n, /sourceKeyLookup|getSourceKeyLookup/u);
  assert.match(i18n, /Object\.hasOwn\(messages, source\)/u);
  assert.match(settings, /<LanguageSelector/u);
  assert.match(languageSelector, /function selectLanguage\(value: AppLocale, close: \(\) => void\) \{[\s\S]*setLocale\(value\);[\s\S]*close\(\);/u);
  assert.match(languageSelector, /value: 'zh-TW'/u);
  assert.match(languageSelector, /value: 'en'/u);
  assert.ok(setup.indexOf('!languageConfirmed') < setup.indexOf('v-else-if="!isAdmin"'));
  assert.ok(setup.indexOf('<LanguageSelector') < setup.indexOf('categoryAdmin.proposalCategories'));
  assert.match(documentTitle, /watch\(\[title, locale\]/u);
  assert.match(documentTitle, /t\(title\.value\)/u);
  assert.match(issueSearch, /return t\('issue\.search\.enterTheKeywordAndPressEnterToSearch'\)/u);
  assert.match(pushPermissionPrompt, /t\([\s\S]*'app\.install\.turnOnNotifications'/u);
  assert.equal(packageJson.scripts['check:i18n'], 'node scripts/check-i18n.mjs');
  assert.match(packageJson.scripts['verify:local'], /npm run check:i18n/u);
  assert.match(i18nCheck, /English catalog is missing/u);
  assert.match(i18nCheck, /hard-coded Han string/u);
  assert.match(i18nCheck, /parseVueSfc/u);
  assert.match(i18nCheck, /static visible template text/u);
  assert.match(i18nCheck, /static user-facing attribute/u);
  assert.match(i18nCheck, /static user-facing object property/u);
  assert.match(i18nCheck, /Locale interpolation parameters do not match/u);
  assert.match(i18nCheck, /readCatalogDirectory/u);
  assert.match(i18nCheck, /key\.length > 55/u);
  assert.match(i18nCheck, /contains key outside its/u);
  assert.match(i18nCheck, /references an unknown API error code/u);
});

test('integration runner gives the Supabase function server a pseudo-terminal', async () => {
  const integrationRunner = await read('scripts/verify-integration-local.sh');

  assert.match(integrationRunner, /START_EXCLUDES="edge-runtime,imgproxy,logflare,realtime,studio,vector"/u);
  assert.match(integrationRunner, /for command_name in docker supabase curl script/u);
  assert.match(integrationRunner, /script --quiet --return --command "\$FUNCTION_SERVE_COMMAND" \/dev\/null/u);
});

test('initial setup reuses the settings-style selected category editor', async () => {
  const setup = await read('src/views/SetupView.vue');
  const sessionRole = await read('src/services/session-role.ts');
  const setupCategorySection = await read('src/components/categories/SetupCategorySection.vue');
  const categoryManagementSection = await read('src/components/categories/CategoryManagementSection.vue');
  const categorySelectorList = await read('src/components/categories/CategorySelectorList.vue');
  const categoryEditor = await read('src/components/categories/CategoryEditorCard.vue');

  assert.match(setup, /<PillSegmentedControl[\s\S]*layout="equal"[\s\S]*<SetupCategorySection/u);
  assert.match(setup, /<SetupCategorySection[\s\S]*#header-actions[\s\S]*<PlatformFeatureToggle/u);
  assert.match(setup, /:disabled="saving \|\| !isSetupValid"/u);
  assert.match(setup, /!issuesEnabled\.value \|\| issueSetupValid\.value/u);
  assert.match(setup, /!facilitiesEnabled\.value \|\| facilitySetupValid\.value/u);
  assert.match(setup, /issueCategories: issuesEnabled\.value \? issueCategories\.value : \[\]/u);
  assert.match(setup, /<ConfirmDialog[\s\S]*setupManagersSkippedTitle[\s\S]*setupManagersSkippedDescription[\s\S]*skipManagersAndComplete/u);
  assert.doesNotMatch(setup, /v-for="\(category, index\) in (?:issue|facility)Categories"/u);
  assert.match(setupCategorySection, /lg:grid-cols-\[15rem_minmax\(0,1fr\)\]/u);
  assert.match(setupCategorySection, /<CategorySelectorList[\s\S]*v-model:selected-index="selectedIndex"[\s\S]*:categories="model"/u);
  assert.match(categoryManagementSection, /<CategorySelectorList[\s\S]*v-model:selected-index="selectedIndex"[\s\S]*:categories="model"[\s\S]*show-default/u);
  assert.match(categoryManagementSection, /<fieldset[\s\S]*:disabled="disabled"[\s\S]*<CategoryEditorCard/u);
  assert.match(categorySelectorList, /v-for="\(category, index\) in categories"[\s\S]*content-trigger/u);
  assert.match(categorySelectorList, /overflow-x-auto[\s\S]*lg:overflow-visible/u);
  assert.match(categorySelectorList, /:aria-current="selectedIndex === index \? 'true' : undefined"/u);
  assert.match(setupCategorySection, /<CategoryEditorCard[\s\S]*flat/u);
  assert.match(categoryEditor, /:is="flat \? 'article' : SurfacePanel"/u);
  assert.match(categoryEditor, /v-if="defaultDraft"[\s\S]*role="switch"[\s\S]*categoryAdmin\.defaultCategory[\s\S]*<SwitchIndicator/u);
  assert.doesNotMatch(categoryEditor, /acceptNewRecords|isActive|archived/u);
  assert.match(categoryEditor, /@click="makeDefault"[\s\S]*emit\('makeDefault'\)/u);
  assert.match(setup, /continueToPlatform[\s\S]*router\.replace\(getDefaultAuthenticatedRoute\(\)\)/u);
  assert.match(setup, /if \(setupCompleted\.value\) await continueToPlatform\(\)/u);
  assert.match(setup, /SETUP_STATUS_REFRESH_INTERVAL_MS[\s\S]*refreshWaitingSetupStatus[\s\S]*setInterval/u);
  assert.match(setup, /visibilitychange/u);
  assert.match(sessionRole, /if \(cached\?\.setupCompleted\)/u);
  assert.match(await read('supabase/functions/backendAction/categories.ts'), /setupState\?\.completed_at[\s\S]*alreadyCompleted: true/u);
});

test('platform feature switches persist atomically and remain configurable after setup', async () => {
  const migration = await read('supabase/migrations/202607200005_platform_feature_switches.sql');
  const atomicManagementMigration = await read('supabase/migrations/202607210002_atomic_category_management.sql');
  const categoryAction = await read('supabase/functions/backendAction/categories.ts');
  const categoryManagement = await read('src/components/admin/CategoryWorkflowPanel.vue');
  const categoryState = await read('src/composables/useCategories.ts');
  const noArchivingMigration = await read('supabase/migrations/202607220002_remove_category_archiving.sql');
  const draftDeletionMigration = await read('supabase/migrations/202607290001_atomic_category_draft_deletions.sql');

  assert.match(migration, /issues_enabled boolean not null default true/u);
  assert.match(migration, /facilities_enabled boolean not null default true/u);
  assert.match(migration, /backend_update_platform_features/u);
  assert.match(migration, /if issues_enabled then[\s\S]*if facilities_enabled then/u);
  assert.match(categoryAction, /action === "savePlatformFeatures"[\s\S]*requirePermission\(auth, "category\.manage"\)/u);
  assert.match(categoryAction, /features:[\s\S]*facilitiesEnabled:[\s\S]*issuesEnabled:/u);
  assert.match(categoryManagement, /activeCategoryKind[\s\S]*PlatformFeatureToggle[\s\S]*saveCategoryManagement[\s\S]*saveAll/u);
  assert.match(categoryManagement, /:disabled="!issuesEnabled"[\s\S]*:disabled="!facilitiesEnabled"/u);
  assert.match(categoryManagement, /SkeletonBlock[\s\S]*skeleton-enter|SkeletonBlock[\s\S]*aria-busy/u);
  assert.match(atomicManagementMigration, /backend_save_category_management[\s\S]*for update[\s\S]*backend_update_platform_features/u);
  assert.match(categoryState, /const loaded = ref\(false\)[\s\S]*if \(!force && loaded\.value\) return/u);
  assert.match(noArchivingMigration, /update app_private\.issue_categories set is_active = true/u);
  assert.match(noArchivingMigration, /issue_categories_always_active_check check \(is_active\)/u);
  assert.match(noArchivingMigration, /facility_categories_always_active_check check \(is_active\)/u);
  assert.match(noArchivingMigration, /backend_save_category_management[\s\S]*comments_enabled=excluded\.comments_enabled,is_active=true/u);
  assert.doesNotMatch(noArchivingMigration, /category->>'isActive'/u);
  assert.doesNotMatch(categoryAction, /saveIssueCategory|saveFacilityCategory|deleteCategory/u);
  assert.match(draftDeletionMigration, /deleted_issue_category_ids[\s\S]*for update[\s\S]*backend_delete_issue_category/u);
  assert.match(draftDeletionMigration, /deleted_facility_category_ids[\s\S]*backend_delete_facility_category/u);
});

test('touch handling blocks double-tap zoom without disabling pinch zoom', async () => {
  const baseStyles = await read('src/styles/base.css');
  const touchZoom = await read('src/lib/touch-zoom.ts');

  assert.match(baseStyles, /body,[\s\S]*#app,[\s\S]*\.app-root \{\s*touch-action: manipulation;/u);
  assert.match(touchZoom, /document\.addEventListener\('touchend'[\s\S]*capture: true, passive: false/u);
  assert.match(touchZoom, /Math\.hypot\(touch\.clientX - previousTouch\.x[\s\S]*event\.preventDefault\(\)/u);
  assert.doesNotMatch(touchZoom, /previousTouch\.target === event\.target/u);
  assert.match(touchZoom, /document\.addEventListener\('dblclick'[\s\S]*event\.preventDefault\(\)[\s\S]*capture: true/u);
  assert.doesNotMatch(touchZoom, /gesturestart|maximum-scale|user-scalable/u);
});

test('public API errors use a generated code-only contract', async () => {
  const apiErrorConfig = JSON.parse(await read('config/api-errors.config.json'));
  const backendResponse = await read('supabase/functions/backendAction/response.ts');
  const sharedHttp = await read('supabase/functions/_shared/http.ts');
  const gatewayHttp = await read('cloudflare/src/http.ts');
  const databaseTypes = await read('supabase/functions/_shared/database.ts');
  const dashboardAction = await read('supabase/functions/backendAction/dashboard.ts');
  const traceStorageMigration = await read('supabase/migrations/202607170001_unify_error_trace_storage.sql');
  const rateLimitConfig = JSON.parse(await read('config/rate-limits.config.json'));
  const packageJson = JSON.parse(await read('package.json'));

  assert.ok(apiErrorConfig['internal-error']);
  assert.ok(apiErrorConfig['rate-limit.operation']);
  assert.match(packageJson.scripts['generate:all'], /generate:api-errors/u);
  assert.doesNotMatch(backendResponse, /message:/u);
  assert.match(backendResponse, /publicErrorBody\(error\)/u);
  assert.doesNotMatch(sharedHttp, /達到上限|太頻繁|上傳額度已用完/u);
  assert.match(gatewayHttp, /retryAfterSeconds/u);
  assert.doesNotMatch(dashboardAction, /[\u3400-\u9fff]/u);
  assert.match(dashboardAction, /failed_task_codes/u);
  assert.doesNotMatch(databaseTypes, /last_error|error_message/u);
  for (const table of ['outbox_events', 'deletion_jobs', 'push_delivery_logs', 'maintenance_runs']) {
    assert.match(
      traceStorageMigration,
      new RegExp(`alter table app_private\\.${table} alter column error_trace_id type uuid`, 'u'),
    );
  }
  assert.match(traceStorageMigration, /fail_outbox_event\(event_id uuid, error_trace_id uuid\)/u);
  assert.match(traceStorageMigration, /raise exception 'validation-invalid'/u);
  for (const value of Object.values(rateLimitConfig)) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'limit')) continue;
    assert.equal(typeof value.errorCode, 'string');
    assert.ok(apiErrorConfig[value.errorCode]);
    assert.equal(Object.hasOwn(value, 'message'), false);
  }
});

test('proposal detail intent prefetches data and renders an immediate summary preview', async () => {
  const board = await read('src/components/IssueBoard.vue');
  const boardTable = await read('src/components/IssueBoardTable.vue');
  const row = await read('src/components/IssueTableRow.vue');
  const card = await read('src/components/ui/organisms/ContentCardShell.vue');
  const detail = await read('src/composables/useIssueRouteDetail.ts');
  const detailView = await read('src/views/IssueDetailView.vue');
  const preview = await read('src/lib/issue-detail-preview.ts');
  const backendRead = await read('supabase/functions/backendAction/issue-read.ts');

  assert.match(card, /@focusin="emit\('intent'\)"[\s\S]*@pointerenter="schedulePointerIntent"[\s\S]*@pointerleave="cancelPointerIntent"/u);
  assert.match(card, /POINTER_INTENT_DELAY_MS = 180[\s\S]*connection\?\.saveData[\s\S]*effectiveType !== '2g'/u);
  assert.match(row, /@intent="emit\('detail-intent', issue\)"/u);
  assert.match(boardTable, /@detail-intent="emit\('detail-intent', \$event\)"/u);
  assert.match(board, /@detail-intent="prefetchIssueDetail"[\s\S]*rememberIssueDetailPreview\(payload\.issue\)[\s\S]*fetchIssueRecordById\(issue\.id/u);
  assert.match(preview, /rememberIssueDetailPreview[\s\S]*takeIssueDetailPreview/u);
  assert.match(detail, /takeIssueDetailPreview\(issueId\)[\s\S]*routeIssuePreview\.value = true[\s\S]*fetchIssueRecordById/u);
  assert.match(detailView, /routeIssueLoading && !routeIssue[\s\S]*:content-loading="routeIssuePreview"/u);
  assert.match(backendRead, /Promise\.all\(\[[\s\S]*selectIssueCategory[\s\S]*issueReadPolicyParams[\s\S]*actor_is_admin: actorCanManage/u);
});

test('navigation and contextual creation share the same responsive information architecture', async () => {
  const appShell = await read('src/components/AppShell.vue');
  const mobileHeader = await read('src/components/app-shell/AppMobileHeader.vue');
  const mobileNav = await read('src/components/app-shell/AppMobileBottomNav.vue');
  const desktopSidebar = await read('src/components/app-shell/AppDesktopSidebar.vue');
  const boardControls = await read('src/components/BoardControls.vue');
  const issueBoard = await read('src/components/IssueBoard.vue');
  const facilitiesView = await read('src/views/FacilitiesView.vue');
  const announcementsView = await read('src/views/AnnouncementsView.vue');
  const settingsPanel = await read('src/components/SettingsPanelContent.vue');
  const administrationView = await read('src/views/AdministrationView.vue');
  const issueComposer = await read('src/components/IssueComposer.vue');
  const composerShell = await read('src/components/ui/organisms/EntryComposerShell.vue');
  const controls = await read('src/styles/controls.css');
  const desktopUtility = await read('src/components/DesktopUtilityDialog.vue');
  const notificationsView = await read('src/views/NotificationsView.vue');
  const navigationStyles = await read('src/styles/navigation.css');
  const responsiveStyles = await read('src/styles/responsive.css');
  const primitives = await read('src/styles/primitives.css');
  const issueComposerView = await read('src/views/IssueComposerView.vue');
  const facilityComposerView = await read('src/views/FacilityComposerView.vue');
  const announcementComposerView = await read('src/views/AnnouncementComposerView.vue');

  assert.match(appShell, /label: t\('issue\.proposal'\)/u);
  assert.match(appShell, /:category-filter="mobileCategoryFilter"/u);
  assert.match(appShell, /route\.name === 'facilities'[\s\S]*activeFacilityCategories[\s\S]*facility\.chooseCategory/u);
  assert.match(appShell, /router\.replace\(\{ name: 'facilities', query: \{ \.\.\.route\.query, category: filter \} \}\)/u);
  assert.match(mobileHeader, /BoardCategorySelector/u);
  assert.match(mobileHeader, /categoryOptions: ReadonlyArray[\s\S]*categorySelectorLabel: string/u);
  assert.doesNotMatch(mobileHeader, /IssueFilter|getIssueFilterOptions/u);
  assert.match(boardControls, /BoardCategorySelector/u);
  assert.match(facilitiesView, /v-model:active-filter="category"/u);
  assert.doesNotMatch(mobileNav, /CreateActionMenu|新增/u);
  assert.doesNotMatch(desktopSidebar, /CreateActionMenu|新增/u);
  assert.ok(mobileNav.indexOf('v-for="item in items"') < mobileNav.indexOf('to="/notifications"'));
  assert.ok(mobileNav.indexOf('to="/notifications"') < mobileNav.indexOf('to="/settings"'));
  assert.ok(desktopSidebar.indexOf('v-for="item in items"') < desktopSidebar.indexOf("$emit('openNotifications')"));
  assert.ok(desktopSidebar.indexOf("$emit('openNotifications')") < desktopSidebar.indexOf("$emit('openProfile')"));
  assert.match(appShell, /<DesktopUtilityDialog[\s\S]*:active-panel="desktopUtilityPanel"[\s\S]*@close="closeDesktopUtility"/u);
  assert.match(boardControls, /v-if="createLabel"[\s\S]*name="plus"/u);
  assert.ok(boardControls.indexOf('name="search"') < boardControls.indexOf('v-if="createLabel"'));
  assert.match(boardControls, /<AppButton[\s\S]{0,120}variant="contextual"[\s\S]{0,120}class="tap-target shrink-0 p-0"[\s\S]*name="plus"/u);
  assert.doesNotMatch(boardControls, /<span class="truncate">\{\{ createLabel \}\}<\/span>/u);
  assert.match(issueBoard, /t\('issue\.addToCategory'/u);
  assert.match(facilitiesView, /:create-label="t\('facility\.addFacility'\)"[\s\S]*@create="openComposer"/u);
  assert.match(facilitiesView, /name: 'facility-create'[\s\S]*category: category\.value/u);
  assert.match(announcementsView, /v-if="isAdmin"[\s\S]*:aria-label="t\('announcement\.newAnnouncement'\)"/u);
  assert.match(announcementsView, /name: 'announcement-create'/u);
  assert.match(issueBoard, /name: 'issue-create'[\s\S]*filter: activeFilter\.value/u);
  assert.match(issueComposer, /EntryComposerShell/u);
  assert.match(composerShell, /<AppButton[\s\S]{0,120}variant="icon"[\s\S]{0,240}name="close"/u);
  assert.match(composerShell, /<AppButton[\s\S]*type="submit"[\s\S]*variant="secondary"[\s\S]*class="entry-composer__action"/u);
  assert.doesNotMatch(issueComposer, /entry-composer__action button-contextual/u);
  assert.match(controls, /\.button-contextual \{[\s\S]*bg-surface[\s\S]*box-shadow: var\(--shadow-card\)/u);
  assert.doesNotMatch(controls, /\.button-dialog-close\b/u);
  assert.match(desktopUtility, /class="desktop-utility-content/u);
  assert.match(notificationsView, /desktop-utility-scroll/u);
  assert.match(navigationStyles, /\.desktop-utility-content \{[\s\S]*clamp\(1rem, 1\.5vw, 1\.25rem\)[\s\S]*padding: var\(--desktop-utility-padding\)/u);
  assert.match(navigationStyles, /\.desktop-utility-scroll,[\s\S]*\.settings-scroll \{[\s\S]*padding: 0\.375rem/u);
  [issueComposerView, facilityComposerView, announcementComposerView]
    .forEach((view) => {
      assert.match(view, /<RoutePageFrame[^>]*layout="fill"[^>]*entry-composer-page/u);
      assert.doesNotMatch(view, /\bbleed\b/u);
    });
  assert.match(responsiveStyles, /\.entry-composer-page \{[\s\S]*max-width: none/u);
  assert.match(responsiveStyles, /\.entry-composer-page__surface \{[\s\S]*border-radius: 0;[\s\S]*box-shadow: none/u);
  assert.match(responsiveStyles, /@media \(min-width: 640px\) \{[\s\S]*\.entry-composer__footer \{[\s\S]*padding-bottom: 0\.375rem;/u);
  assert.match(responsiveStyles, /@media \(max-width: 767px\) \{[\s\S]*\.entry-composer-page__surface \{[\s\S]*padding-bottom: max\(0\.75rem, calc\(env\(safe-area-inset-bottom\) - 1rem\)\);[\s\S]*padding-left: 0;[\s\S]*padding-right: 0;/u);
  assert.match(appShell, /'--app-bottom-nav-gap':[\s\S]*bottomGap\.value/u);
  assert.match(primitives, /\.route-page-frame--bottom-safe \{[\s\S]*padding-bottom: max\(0px, calc\(var\(--app-bottom-nav-height\) \+ var\(--app-bottom-nav-gap\) - 0\.375rem\)\);/u);
  assert.match(responsiveStyles, /\.dialog-surface\.surface-pad-lg \{[\s\S]*padding-top: calc\(var\(--panel-padding\) \+ 0\.375rem\)/u);
  assert.ok(settingsPanel.indexOf('issue.myProposal') < settingsPanel.indexOf('dashboard.statistics'));
  assert.ok(settingsPanel.indexOf('dashboard.statistics') < settingsPanel.indexOf('adminCenter.openManagement'));
  assert.ok(settingsPanel.indexOf('adminCenter.openManagement') < settingsPanel.indexOf('settings.restartApp'));
  assert.ok(settingsPanel.indexOf('settings.restartApp') < settingsPanel.indexOf('settings.moreResources'));
  assert.match(administrationView, /reactive\(new Set<AdministrationTab>\(\[activeTab\.value\]\)\)/u);
  assert.match(administrationView, /v-if="visitedTabs\.has\('categories'\)"[\s\S]*v-show="activeTab === 'categories'"/u);
  assert.match(administrationView, /v-if="visitedTabs\.has\('members'\)"[\s\S]*v-show="activeTab === 'members'"/u);
  await assert.rejects(read('src/components/CreateActionMenu.vue'));
  await assert.rejects(read('src/composables/useCreateEntryActions.ts'));
});
