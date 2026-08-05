import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';
import { read, listFiles } from './helpers.mjs';

test('authenticated route pages share one content width and AppShell owns horizontal gutters', async () => {
  const primitives = await read('src/styles/primitives.css');
  const contentStyles = await read('src/styles/content.css');
  const appShell = await read('src/components/AppShell.vue');
  const viewportFrame = await read('src/components/ui/organisms/ViewportFrame.vue');
  const routePageFrame = await read('src/components/ui/organisms/RoutePageFrame.vue');
  const detailShell = await read('src/components/ui/organisms/DetailPageShell.vue');
  const detailSkeleton = await read('src/components/ui/organisms/SkeletonDetail.vue');
  const mobileHeader = await read('src/components/app-shell/AppMobileHeader.vue');
  const mobileNav = await read('src/components/app-shell/AppMobileBottomNav.vue');
  const feedbackBar = await read('src/components/ActionFeedbackBar.vue');
  const emptyState = await read('src/components/ui/molecules/EmptyStatePanel.vue');
  const pageLoadFailure = await read('src/components/ui/molecules/PageLoadFailure.vue');
  const issueBoard = await read('src/components/IssueBoard.vue');
  const settingsPanel = await read('src/components/SettingsPanelContent.vue');
  const routePages = await Promise.all([
    'src/views/IssueBoardView.vue',
    'src/views/FacilitiesView.vue',
    'src/views/AnnouncementsView.vue',
    'src/views/NotificationsView.vue',
    'src/views/SettingsView.vue',
    'src/views/DashboardView.vue',
    'src/views/AdministrationView.vue',
    'src/views/IssueDetailView.vue',
    'src/views/FacilityDetailView.vue',
    'src/views/AnnouncementDetailView.vue',
  ].map(read));

  const baseStyles = await read('src/styles/base.css');
  assert.match(baseStyles, /--app-content-max-width: 80rem;/u);
  assert.match(baseStyles, /--app-viewport-gutter: 1rem;/u);
  assert.match(primitives, /\.viewport-frame \{[\s\S]*margin-inline: 0;[\s\S]*padding-left: max\(var\(--app-viewport-gutter\), env\(safe-area-inset-left\)\);[\s\S]*padding-right: max\(var\(--app-viewport-gutter\), env\(safe-area-inset-right\)\);[\s\S]*width: 100%;/u);
  assert.doesNotMatch(primitives, /viewport-shadow-bleed|\.viewport-frame \{[\s\S]{0,300}margin-(?:left|right): calc/u);
  assert.match(contentStyles, /\.scroll-shadow-space--compact \{[\s\S]*margin-inline: 0;[\s\S]*padding-inline:/u);
  assert.match(contentStyles, /\.comment-feed-scroll \{[\s\S]*padding-bottom: max\(0\.75rem, calc\(var\(--app-bottom-nav-height\) \+ var\(--app-bottom-nav-gap\) \+ 7rem\)\);[\s\S]*scroll-padding-bottom:/u);
  assert.match(contentStyles, /\.comment-composer-dock \{[\s\S]*bottom: max\([\s\S]*var\(--app-bottom-nav-height\)[\s\S]*env\(safe-area-inset-bottom\)[\s\S]*position: fixed;/u);
  assert.match(contentStyles, /@media \(min-width: 768px\) \{[\s\S]*\.scroll-shadow-space,[\s\S]*\.scroll-shadow-space--compact \{[\s\S]*padding-bottom: var\(--scroll-shadow-space\);/u);
  assert.match(primitives, /\.viewport-floating-inline \{[\s\S]*left: max\(var\(--app-viewport-gutter\), env\(safe-area-inset-left\)\);[\s\S]*right: max\(var\(--app-viewport-gutter\), env\(safe-area-inset-right\)\);/u);
  assert.match(primitives, /\.route-page-frame \{[\s\S]*max-width: var\(--app-content-max-width\);[\s\S]*min-width: 0;[\s\S]*width: 100%;/u);
  assert.match(primitives, /\.route-page-frame--fill \{[\s\S]*flex: 1 1 0%;[\s\S]*height: 100%;[\s\S]*min-height: 0;/u);
  assert.doesNotMatch(primitives, /route-page-frame--bleed|route-page-bleed/u);
  assert.match(primitives, /\.route-page-frame--bottom-safe \{[\s\S]*padding-bottom: 1rem/u);
  assert.doesNotMatch(baseStyles, /\.app-viewport-frame/u);
  assert.match(viewportFrame, /class="viewport-frame"/u);
  assert.doesNotMatch(viewportFrame, /viewport-content|content\?:/u);
  assert.match(routePageFrame, /class="route-page-frame"[\s\S]*route-page-frame--\$\{layout\}[\s\S]*route-page-frame--padding-\$\{padding\}/u);
  assert.doesNotMatch(routePageFrame, /bleed/u);
  assert.match(appShell, /<ViewportFrame as="main" class="flex min-h-0 flex-1 flex-col">/u);
  assert.match(mobileHeader, /<ViewportFrame/u);
  assert.doesNotMatch(mobileHeader, /mx-auto|max-w-/u);
  assert.match(mobileNav, /viewport-floating-inline/u);
  assert.doesNotMatch(mobileNav, /\bleft-4\b|\bright-4\b/u);
  routePages.forEach((page) => assert.match(page, /<RoutePageFrame/u));
  routePages.forEach((page) => assert.doesNotMatch(page, /\broute-page\b|page-bottom-safe/u));
  routePages.forEach((page) => assert.doesNotMatch(page, /app-viewport-gutter|safe-area-inset-(?:left|right)/u));
  routePages.slice(7).forEach((page) => assert.match(page, /<RoutePageFrame as="div" bottom-safe layout="fill">/u));
  [detailShell, detailSkeleton].forEach((detail) => {
    assert.match(detail, /class="[^"]*h-full min-h-0 flex-col overflow-visible/u);
    assert.match(detail, /class="grid min-h-0 min-w-0 flex-1/u);
    assert.doesNotMatch(detail, /min-h-\[calc\(100dvh/u);
  });
  assert.doesNotMatch(issueBoard, /app-viewport-gutter/u);
  assert.match(appShell, /app-main-content[^"\n]*overflow-auto/u);
  assert.doesNotMatch(contentStyles, /\.issue-card-grid \{[^}]*padding:/u);
  assert.match(contentStyles, /\.scroll-shadow-space \{[\s\S]*--scroll-shadow-space: 0\.625rem[\s\S]*margin: 0;[\s\S]*padding-left: var\(--scroll-shadow-space\);[\s\S]*padding-top: var\(--scroll-shadow-space\);/u);
  assert.doesNotMatch(contentStyles, /scroll-shadow-(?:space|bleed)[\s\S]{0,220}calc\(var\(--scroll-shadow-(?:space|bleed)\) \* -1\)/u);
  [issueBoard, routePages[1]]
    .forEach((page) => assert.match(page, /scroll-shadow-space[\s\S]*overflow-auto/u));
  assert.match(emptyState, /class="flex w-full min-w-0/u);
  // Empty boards must not paint a card-elevation icon tile that looks like a residual skeleton card.
  assert.match(emptyState, /<IconTile[\s\S]*elevation="none"/u);
  assert.match(pageLoadFailure, /<SurfacePanel padding="lg" class="flex w-full min-w-0/u);
  assert.match(feedbackBar, /action-feedback-card[\s\S]*min-h-14 w-full/u);
  assert.match(contentStyles, /\.settings-scroll--flat \{[\s\S]*@apply overflow-visible px-0 py-3/u);
  assert.match(settingsPanel, /flat \? 'settings-panel--flat overflow-visible' : 'overflow-hidden'/u);
  assert.match(settingsPanel, /flat[\s\S]*\? 'settings-scroll--flat overflow-visible'[\s\S]*: 'overflow-auto'/u);
  assert.doesNotMatch(settingsPanel, /settings-scroll min-h-0 min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto/u);
  assert.doesNotMatch(routePages[3], /px-0\.5|sm:px-1/u);
  assert.doesNotMatch(routePages[4], /:class="\{ 'px-1': true \}"/u);
  assert.doesNotMatch(routePages[4], /overflow-x-hidden/u);
  assert.doesNotMatch(routePages[5], /space-y-5 px-2/u);
  assert.doesNotMatch(routePages[7], /px-1|sm:px-2/u);
});

test('reusable UI primitives own buttons, surfaces, lists, dropdowns, controls, and elevation', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  const styleEntry = await read('src/style.css');
  const baseStyles = await read('src/styles/base.css');
  const componentStyles = await read('src/styles/components.css');
  const primitives = await read('src/styles/primitives.css');
  const appButton = await read('src/components/ui/atoms/AppButton.vue');
  const iconTile = await read('src/components/ui/atoms/IconTile.vue');
  const switchIndicator = await read('src/components/ui/atoms/SwitchIndicator.vue');
  const characterCount = await read('src/components/ui/atoms/CharacterCount.vue');
  const inlineAlert = await read('src/components/ui/atoms/InlineAlert.vue');
  const inlineMessage = await read('src/components/ui/atoms/InlineMessage.vue');
  const skeletonBlock = await read('src/components/ui/atoms/SkeletonBlock.vue');
  const decodedImage = await read('src/components/ui/atoms/DecodedImage.vue');
  const imageRemoveButton = await read('src/components/ui/atoms/ImageRemoveButton.vue');
  const tagBadge = await read('src/components/ui/atoms/TagBadge.vue');
  const iconListRow = await read('src/components/ui/molecules/IconListRow.vue');
  const labeledListSection = await read('src/components/ui/molecules/LabeledListSection.vue');
  const sectionHeader = await read('src/components/ui/molecules/SectionHeader.vue');
  const countedTextField = await read('src/components/ui/molecules/CountedTextField.vue');
  const countedTextareaField = await read('src/components/ui/molecules/CountedTextareaField.vue');
  const dialogActionRow = await read('src/components/ui/molecules/DialogActionRow.vue');
  const dialogHeading = await read('src/components/ui/molecules/DialogHeading.vue');
  const editorSurface = await read('src/components/ui/molecules/EditorSurface.vue');
  const editorModeBar = await read('src/components/ui/molecules/EditorModeBar.vue');
  const surfacePanel = await read('src/components/ui/molecules/SurfacePanel.vue');
  const listSurfaceRow = await read('src/components/ui/molecules/ListSurfaceRow.vue');
  const dropdownPanel = await read('src/components/ui/molecules/DropdownPanel.vue');
  const dropdownMenu = await read('src/components/ui/molecules/DropdownMenu.vue');
  const contentCard = await read('src/components/ui/organisms/ContentCardShell.vue');
  const contentCardCollection = await read('src/components/ui/organisms/ContentCardCollection.vue');
  const tableGridPicker = await read('src/components/ui/molecules/TableGridPicker.vue');
  const dialogShell = await read('src/components/ui/organisms/DialogShell.vue');
  const responsiveStyles = await read('src/styles/responsive.css');
  const confirmDialog = await read('src/components/ConfirmDialog.vue');
  const entryComposer = await read('src/components/ui/organisms/EntryComposerShell.vue');
  const markdownImageEditor = await read('src/components/ui/organisms/MarkdownImageEditor.vue');
  const compactMenu = await read('src/components/CompactActionMenu.vue');
  const boardControls = await read('src/components/BoardControls.vue');
  const loginPanel = await read('src/components/LoginPanel.vue');
  const loginView = await read('src/views/LoginView.vue');
  const settingsPanel = await read('src/components/SettingsPanelContent.vue');
  const languageSelector = await read('src/components/LanguageSelector.vue');
  const commentComposer = await read('src/components/CommentComposer.vue');
  const markdownMediaContent = await read('src/components/MarkdownMediaContent.vue');
  const markdownImagePreviews = await read('src/components/ui/molecules/MarkdownImagePreviews.vue');
  const userAvatar = await read('src/components/ui/atoms/UserAvatar.vue');
  const contentCardSkeleton = await read('src/components/ui/organisms/ContentCardSkeleton.vue');
  const segmentedControl = await read('src/components/ui/molecules/PillSegmentedControl.vue');
  const controls = await read('src/styles/controls.css');
  const contentStyles = await read('src/styles/content.css');
  const notifications = await read('src/views/NotificationsView.vue');
  const settingsView = await read('src/views/SettingsView.vue');
  const dashboardView = await read('src/views/DashboardView.vue');
  const checker = await read('scripts/check-ui-primitives.mjs');
  const pressFeedback = await read('src/lib/press-feedback.ts');
  const uiMotion = await read('src/lib/ui-motion.ts');
  const app = await read('src/App.vue');
  const issueBoardTable = await read('src/components/IssueBoardTable.vue');
  const facilityTable = await read('src/components/FacilityTable.vue');
  const mainEntry = await read('src/main.ts');

  assert.match(styleEntry, /@import "\.\/styles\/primitives\.css";/u);
  for (const token of ['--shadow-control', '--shadow-card', '--shadow-floating']) {
    assert.match(baseStyles, new RegExp(`${token}:`, 'u'));
    assert.match(primitives, new RegExp(`var\\(${token}\\)`, 'u'));
  }
  for (const primitive of [
    '.surface-control',
    '.surface-card',
    '.surface-floating',
    '.progress-fill',
    '.switch-indicator',
    '.switch-indicator--checked',
    '.inline-alert',
    '.inline-alert--error',
    '.inline-alert--warning',
    '.inline-message',
    '.inline-message--error',
    '.dialog-card',
    '.dialog-title',
    '.dialog-description',
    '.dialog-actions',
    '.editor-surface',
    '.editor-surface--elevated',
    '.editor-surface--muted',
    '.editor-mode-bar',
    '.list-section-label',
    '.list-surface',
    '.list-surface-row',
    '.dropdown-panel',
    '.dropdown-item',
    '.dropdown-label',
    '.control-frame',
    '.control-footer',
    '.skeleton-block',
    '.skeleton-card',
  ]) {
    assert.ok(primitives.includes(primitive), `missing UI primitive ${primitive}`);
  }

  assert.match(appButton, /type ButtonVariant =[\s\S]*\| 'contextual'[\s\S]*\| 'toolbar'/u);
  assert.match(appButton, /'icon-pill': 'button-icon-pill'/u);
  assert.match(iconTile, /tone\?: 'danger' \| 'info' \| 'inverse' \| 'neutral' \| 'surface' \| 'warning'/u);
  assert.match(switchIndicator, /aria-hidden="true"/u);
  assert.doesNotMatch(switchIndicator, /role="switch"|aria-checked/u);
  assert.match(settingsPanel, /role="switch"[\s\S]*:aria-checked="pushEnabled"/u);
  assert.match(characterCount, /current > warningAt[\s\S]*\{\{ current \}\} \/ \{\{ max \}\}/u);
  assert.match(inlineAlert, /class="inline-alert"[\s\S]*inline-alert--\$\{tone\}[\s\S]*:aria-live="live"/u);
  assert.match(inlineMessage, /class="inline-message"[\s\S]*inline-message--\$\{tone\}[\s\S]*inline-message--\$\{size\}/u);
  assert.match(skeletonBlock, /<component :is="as" class="skeleton-block" aria-hidden="true">/u);
  assert.match(decodedImage, /<LoadingSpinner[\s\S]*decoding="async"[\s\S]*@load="handleLoad"/u);
  assert.match(decodedImage, /await image\.decode\(\)[\s\S]*image\.naturalWidth === 0[\s\S]*ready\.value = true/u);
  assert.match(componentStyles, /\.decoded-image__media \{[\s\S]*opacity: 0;[\s\S]*transition: opacity var\(--motion-duration\)/u);
  assert.match(componentStyles, /\.decoded-image--ready \.decoded-image__media \{[\s\S]*opacity: 1;/u);
  assert.match(baseStyles, /--motion-ease-spring: linear\([^)]+\);[\s\S]*--press-scale: 1\.07;/u);
  assert.match(baseStyles, /--press-scale: 1\.07;/u);
  assert.match(baseStyles, /\):active,[\s\S]*\.is-pressing \{[\s\S]*scale: var\(--press-scale\)/u);
  assert.match(componentStyles, /\.content-trigger \{[\s\S]*--press-scale: 1\.025;/u);
  assert.match(componentStyles, /\.button-contextual:is\(:active, \.is-pressing\)[\s\S]*background-color: rgb\(var\(--color-secondary-container\) \/ 0\.92\);/u);
  assert.match(primitives, /\.list-surface-row--interactive:is\(:active, \.is-pressing\)[\s\S]*box-shadow: var\(--shadow-card\);/u);
  assert.doesNotMatch(componentStyles, /:active[^}]+scale\(0\.9/u);
  assert.match(pressFeedback, /RELEASE_VISIBLE_MS = 160[\s\S]*MOVE_TOLERANCE_PX = 12/u);
  assert.match(pressFeedback, /\[data-list-row-trigger\][\s\S]*classList\.add\('is-pressing'\)[\s\S]*pointermove/u);
  assert.match(mainEntry, /initializePressFeedback\(\)/u);
  [markdownMediaContent, markdownImagePreviews, commentComposer, userAvatar]
    .forEach((consumer) => assert.match(consumer, /<DecodedImage/u));
  assert.equal([...markdownMediaContent.matchAll(/<DecodedImage\b/gu)].length, 2);
  assert.match(imageRemoveButton, /class="button-remove-image"[\s\S]*<AppIcon name="close"/u);
  assert.match(tagBadge, /size === 'sm' \? 'tag-sm' : 'tag'/u);
  assert.match(iconListRow, /<ListSurfaceRow[\s\S]*<AppIcon :name="icon"[\s\S]*<slot name="trailing">/u);
  assert.match(labeledListSection, /class="list-section-label"[\s\S]*<SurfacePanel variant="list">/u);
  assert.match(sectionHeader, /<component :is="headingAs"[\s\S]*<slot name="trailing"/u);
  assert.match(countedTextField, /<CharacterCount :current="value\.length"/u);
  assert.match(countedTextareaField, /<textarea[\s\S]*<CharacterCount :current="value\.length"/u);
  assert.match(dialogActionRow, /<footer class="dialog-actions">[\s\S]*<slot \/>/u);
  assert.match(dialogHeading, /class="dialog-eyebrow"[\s\S]*class="dialog-title"[\s\S]*class="dialog-description"/u);
  assert.match(editorSurface, /class="editor-surface"[\s\S]*editor-surface--elevated/u);
  assert.match(editorModeBar, /class="editor-mode-bar"[\s\S]*<AppButton variant="toolbar"/u);
  assert.match(surfacePanel, /type SurfaceVariant = 'card' \| 'control' \| 'floating' \| 'inset' \| 'list'/u);
  assert.match(listSurfaceRow, /class="list-surface-row"[\s\S]*list-surface-row--interactive/u);
  assert.match(dropdownPanel, /class="dropdown-panel"/u);
  assert.match(dropdownMenu, /<PopoverRoot[\s\S]*<PopoverAnchor[\s\S]*<PopoverContent[\s\S]*<DropdownPanel/u);
  assert.match(dropdownMenu, /:collision-padding="12"[\s\S]*:side-offset="8"/u);
  assert.doesNotMatch(dropdownMenu, /useDropdownPosition|useClickOutside|handlePanelKeydown/u);
  assert.match(dropdownMenu, /focusTarget\.focus\(\{ preventScroll: true \}\)/u);
  assert.match(dropdownMenu, /@close-auto-focus="handleCloseAutoFocus"/u);
  assert.match(dropdownMenu, /:open="rootOpen"[\s\S]*@after-leave="handleAfterLeave"[\s\S]*v-if="visible"/u);
  assert.match(contentCard, /surface-card surface-card--interactive/u);
  assert.match(contentCard, /<button[\s\S]*pointer-events-none absolute inset-0[\s\S]*:aria-label="title"[\s\S]*@click\.stop="emit\('open'\)"/u);
  assert.match(contentCard, /NESTED_INTERACTIVE_SELECTOR[\s\S]*event\.target\.closest[\s\S]*emit\('open'\)/u);
  assert.match(tableGridPicker, /role="grid"[\s\S]*role="row"[\s\S]*role="gridcell"[\s\S]*type="button"/u);
  assert.match(tableGridPicker, /:aria-label="t\('markdown\.createTable', \{ rows: r, columns: c \}\)"/u);
  assert.match(tableGridPicker, /:tabindex="cellIndex\(r - 1, c - 1\) === focusedIndex \? 0 : -1"/u);
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter']) {
    assert.match(tableGridPicker, new RegExp(`event\\.key === '${key}'`, 'u'));
  }
  assert.match(tableGridPicker, /event\.key === ' '/u);
  assert.match(dialogShell, /<DrawerRoot[\s\S]*<DrawerContent[\s\S]*<DialogRoot[\s\S]*<DialogContent/u);
  assert.match(dialogShell, /DrawerOverlay force-mount[\s\S]*DialogOverlay force-mount/u);
  assert.match(dialogShell, /handleDismissEvent[\s\S]*event\.preventDefault\(\)/u);
  assert.match(dialogShell, /:open="rootOpen"[\s\S]*@after-leave="handleAfterLeave"[\s\S]*v-if="visible"/u);
  assert.doesNotMatch(dialogShell, /useBodyScrollLock|useDialogFocus|useBottomSheetDrag/u);
  assert.match(responsiveStyles, /\.dialog-backdrop \{[\s\S]*blur\(12px\) saturate\(0\.88\)[\s\S]*position: fixed;[\s\S]*inset: 0;/u);
  assert.match(responsiveStyles, /\.dialog-enter-active \{[\s\S]*visibility 300ms/u);
  assert.match(responsiveStyles, /\.dialog-leave-active \{[\s\S]*visibility 190ms/u);
  assert.match(responsiveStyles, /\.dialog-enter-active \.dialog-backdrop \{[\s\S]*opacity 220ms/u);
  assert.doesNotMatch(responsiveStyles, /\.dialog-enter-active \.dialog-backdrop \{[\s\S]{0,240}backdrop-filter/u);
  assert.match(responsiveStyles, /\.dialog-enter-active \[data-dialog-root\] \{[\s\S]*transform 300ms var\(--motion-ease-enter\)/u);
  assert.match(responsiveStyles, /\.dialog-leave-active \[data-dialog-root\] \{[\s\S]*transform 190ms var\(--motion-ease-exit\)/u);
  assert.match(responsiveStyles, /--drawer-swipe-movement-y/u);
  assert.match(responsiveStyles, /\.bottom-sheet-surface\[data-swiping\]/u);
  assert.match(primitives, /\.progress-fill \{[\s\S]*transform-origin: 0 50%;[\s\S]*transform 560ms/u);
  assert.match(confirmDialog, /<DialogShell[\s\S]*described-by="confirm-dialog-message"/u);
  assert.match(confirmDialog, /<DialogActionRow>[\s\S]*<AppButton/u);
  assert.match(confirmDialog, /<DialogHeading[\s\S]*description-id="confirm-dialog-message"/u);
  assert.match(entryComposer, /<SurfacePanel[\s\S]*aria-labelledby="entry-composer-title"/u);
  assert.match(compactMenu, /<AdaptiveActionMenu/u);
  assert.doesNotMatch(contentCard, /longPressEnabled|<slot name="admin"|<slot name="dialogs"/u);
  assert.equal([...boardControls.matchAll(/<DropdownMenu\b/gu)].length, 2);
  assert.match(settingsPanel, /<LabeledListSection[\s\S]*<IconListRow/u);
  assert.match(settingsPanel, /<LabeledListSection :label="t\('settings\.language'\)">[\s\S]*<LanguageSelector/u);
  assert.match(languageSelector, /<DropdownMenu[\s\S]*role="listbox"[\s\S]*v-for="option in languageOptions"/u);
  assert.match(languageSelector, /<IconListRow[\s\S]*icon="globe"[\s\S]*#trailing/u);
  assert.doesNotMatch(contentStyles, /\.settings-row \{[\s\S]{0,100}\bpx-0\b/u);
  assert.match(settingsPanel, /<SwitchIndicator[\s\S]*:checked=/u);
  assert.match(settingsPanel, /<ListSurfaceRow[\s\S]*interactive/u);
  assert.match(commentComposer, /control-frame/u);
  assert.match(commentComposer, /<EditorSurface[\s\S]*tone="muted"[\s\S]*<ImageRemoveButton/u);
  assert.match(contentCardSkeleton, /<SurfacePanel[\s\S]*class="issue-card"[\s\S]*class="skeleton-card"/u);
  assert.match(primitives, /@keyframes skeleton-card-enter \{[\s\S]*from \{[\s\S]*opacity: 0;[\s\S]*\}/u);
  assert.doesNotMatch(primitives, /@keyframes skeleton-card-enter \{[\s\S]*transform:/u);
  assert.match(segmentedControl, /ACTIVE_SEGMENT_WIDTH_REM = 7/u);
  assert.match(segmentedControl, /:style="containerStyle"/u);
  assert.match(segmentedControl, /segmented-control__indicator[\s\S]*--segment-active-index[\s\S]*--segment-count/u);
  assert.doesNotMatch(segmentedControl, /ResizeObserver|offsetWidth|offsetLeft/u);
  assert.match(segmentedControl, /<m\.div[\s\S]*:animate="indicatorMotion"[\s\S]*MOTION_SMOOTH_SPRING/u);
  assert.match(controls, /\.segmented-control__indicator \{[\s\S]*will-change: transform/u);
  assert.match(controls, /\.segmented-control__button--active \{[\s\S]*width: 7rem/u);
  assert.match(controls, /\.segmented-control__button--compact \{[\s\S]*width: 2rem/u);
  assert.match(app, /<MotionConfig reduced-motion="user"[\s\S]*<LazyMotion strict/u);
  assert.match(app, /<AnimatePresence mode="popLayout"[\s\S]*MOTION_ROUTE_TRANSITION/u);
  assert.match(uiMotion, /MOTION_SMOOTH_SPRING[\s\S]*MOTION_ROUTE_TRANSITION[\s\S]*getStaggerTransition/u);
  [issueBoardTable, facilityTable].forEach((table) => {
    assert.match(table, /<AnimatePresence mode="popLayout" :initial="false">[\s\S]*<m\.div[\s\S]*\blayout\b/u);
  });
  assert.match(notifications, /<ListSurfaceRow[\s\S]*interactive[\s\S]*class="notification-group-row feed-enter"/u);
  assert.match(notifications, /<ListSurfaceRow[\s\S]*as="div"[\s\S]*class="notification-group-row skeleton-enter/u);
  assert.match(settingsView, /v-if="loading"[\s\S]*<SurfacePanel variant="list"/u);
  assert.match(loginPanel, /<InlineAlert[\s\S]*tone="error"[\s\S]*compact/u);
  assert.match(loginView, /items-start justify-center[\s\S]*md:pt-\[clamp\(5rem,16dvh,10rem\)\]/u);
  assert.match(contentCardCollection, /<InlineMessage v-else-if="error"[\s\S]*size="sm"/u);
  assert.equal([...dashboardView.matchAll(/<SectionHeader\b/gu)].length, 4);
  assert.equal([...markdownImageEditor.matchAll(/<EditorModeBar\b/gu)].length, 3);
  assert.doesNotMatch(dashboardView, /dashboard-section-(?:head|title|subtitle)/u);

  assert.equal(packageJson.scripts['check:ui'], 'node scripts/check-ui-primitives.mjs');
  assert.equal(packageJson.scripts['verify:local'], 'node scripts/run-local-verification.mjs');
  assert.match(await read('scripts/run-local-verification.mjs'), /check-ui-primitives\.mjs/u);
  assert.match(checker, /legacy popover-panel/u);
  assert.match(checker, /hard-codes floating viewport gutters/u);
  assert.match(checker, /defines an arbitrary shadow/u);
  assert.match(checker, /assembles a card surface manually/u);
  assert.match(checker, /assembles dialog behavior directly/u);
  assert.match(checker, /assembles dialog actions directly/u);
});

test('pull requests and backend deployments retain the local integration gate', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  const verifyPr = await read('.github/workflows/verify-pr.yml');
  const deployBackend = await read('.github/workflows/deploy-backend.yml');
  const agents = await read('AGENTS.md');

  assert.equal(
    packageJson.scripts['verify:all'],
    'node scripts/run-local-verification.mjs --all',
  );
  assert.match(await read('scripts/run-local-verification.mjs'), /verify-integration-local\.mjs[\s\S]*--e2e/u);
  assert.match(verifyPr, /Full local backend integration[\s\S]*npm run verify:integration/u);
  assert.match(verifyPr, /Check Cloudflare Worker[\s\S]*npm run check:worker/u);
  assert.match(verifyPr, /denoland\/setup-deno@v2[\s\S]*npm run verify:integration/u);
  assert.doesNotMatch(verifyPr, /NOVAE_DENO_BIN|\/home\/runner\/\.deno/u);
  assert.match(
    deployBackend,
    /Verify local database, permissions, and Edge workflows[\s\S]*npm run verify:integration/u,
  );
  assert.match(
    deployBackend,
    /denoland\/setup-deno@v2[\s\S]*npm run verify:integration/u,
  );
  assert.doesNotMatch(deployBackend, /NOVAE_DENO_BIN|\/home\/runner\/\.deno/u);
  assert.match(agents, /新增 backend action 必須在 `tests\/integration\/`/u);
});

test('backend deployment synchronizes only Firebase third-party auth configuration', async () => {
  const deployBackend = await read('.github/workflows/deploy-backend.yml');
  const syncScript = await read('scripts/sync-supabase-firebase-auth.mjs');

  assert.match(
    deployBackend,
    /Synchronize Firebase third-party authentication[\s\S]*node scripts\/sync-supabase-firebase-auth\.mjs/u,
  );
  assert.match(deployBackend, /'scripts\/sync-supabase-firebase-auth\.mjs'/u);
  assert.match(deployBackend, /version: 2\.110\.0/u);
  assert.doesNotMatch(deployBackend, /supabase config push/u);
  assert.match(syncScript, /\/config\/auth\/third-party-auth/u);
  assert.match(syncScript, /oidc_issuer_url: desiredIssuer/u);
  assert.match(syncScript, /method: 'DELETE'/u);
  assert.doesNotMatch(syncScript, /config\/storage|vectorBuckets/u);
});

test('Firebase third-party auth synchronization is idempotent and removes stale issuers', async () => {
  const { syncSupabaseFirebaseAuth } = await import(
    new URL('../../scripts/sync-supabase-firebase-auth.mjs', import.meta.url)
  );
  const desired = {
    id: 'desired-id',
    type: 'firebase',
    oidc_issuer_url: 'https://securetoken.google.com/novae-test',
  };
  const stale = {
    id: 'stale-id',
    type: 'firebase',
    oidc_issuer_url: 'https://securetoken.google.com/novae-old',
  };
  const requests = [];
  const listResponses = [[stale], [stale, desired], [desired]];
  const jsonResponse = (body, status) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    text: async () => JSON.stringify(body),
  });
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url, init });
    if ((init.method ?? 'GET') === 'GET') {
      return jsonResponse(listResponses.shift(), 200);
    }
    if (init.method === 'POST') {
      return jsonResponse(desired, 201);
    }
    if (init.method === 'DELETE') {
      return jsonResponse(stale, 200);
    }
    return jsonResponse(null, 405);
  };

  const result = await syncSupabaseFirebaseAuth({
    accessToken: 'test-token',
    projectRef: 'abcdefghijklmnopqrst',
    firebaseProjectId: 'novae-test',
    fetchImpl,
    apiOrigin: 'https://management.test',
  });

  assert.deepEqual(result, {
    issuer: desired.oidc_issuer_url,
    created: true,
    removedStale: 1,
  });
  assert.deepEqual(
    requests.map(({ init }) => init.method ?? 'GET'),
    ['GET', 'POST', 'GET', 'DELETE', 'GET'],
  );
  assert.equal(
    JSON.parse(requests[1].init.body).oidc_issuer_url,
    desired.oidc_issuer_url,
  );
  assert.match(requests[3].url, /\/third-party-auth\/stale-id$/u);
  assert.ok(requests.every(({ init }) => init.headers.authorization === 'Bearer test-token'));

  const repeatRequests = [];
  const repeatResult = await syncSupabaseFirebaseAuth({
    accessToken: 'test-token',
    projectRef: 'abcdefghijklmnopqrst',
    firebaseProjectId: 'novae-test',
    apiOrigin: 'https://management.test',
    fetchImpl: async (url, init = {}) => {
      repeatRequests.push({ url, init });
      return jsonResponse([desired], 200);
    },
  });
  assert.deepEqual(repeatResult, {
    issuer: desired.oidc_issuer_url,
    created: false,
    removedStale: 0,
  });
  assert.deepEqual(
    repeatRequests.map(({ init }) => init.method ?? 'GET'),
    ['GET', 'GET'],
  );
});

test('the Windows test environment passes emulator settings out of WSL', async () => {
  const integrationScript = await read('scripts/verify-integration-local.sh');
  const authProbe = await read('scripts/check-local-auth-emulator.mjs');

  assert.match(integrationScript, /VITE_FIREBASE_AUTH_EMULATOR_URL=http:\/\/127\.0\.0\.1:9099/u);
  assert.match(integrationScript, /VITE_FIREBASE_AUTH_EMULATOR_URL\/w/u);
  assert.doesNotMatch(integrationScript, /VITE_[A-Z_]+\/u/u);
  assert.match(integrationScript, /--port 5173 --strictPort/u);
  assert.match(integrationScript, /netstat\.exe -ano/u);
  assert.match(integrationScript, /taskkill\.exe \/PID "\$VITE_WINDOWS_PID" \/T \/F/u);
  assert.match(integrationScript, /scripts\/check-local-auth-emulator\.mjs/u);
  assert.match(authProbe, /claims\.role|\.role, 'authenticated'/u);
  assert.match(authProbe, /getCurrentUserRole/u);
  assert.match(authProbe, /setupCompleted, false/u);
});

test('GitHub workflows use the current Node 24 action generations', async () => {
  const workflowPaths = [
    '.github/workflows/deploy-backend.yml',
    '.github/workflows/deploy-frontend.yml',
    '.github/workflows/reset-db.yml',
    '.github/workflows/verify-pr.yml',
  ];
  const workflows = await Promise.all(workflowPaths.map((path) => read(path)));
  const combined = workflows.join('\n');

  assert.doesNotMatch(
    combined,
    /actions\/checkout@v[1-6]\b|actions\/setup-node@v[1-6]\b|supabase\/setup-cli@v[1-2]\b/u,
  );
  assert.match(combined, /actions\/checkout@v7/u);
  assert.match(combined, /actions\/setup-node@v7[\s\S]*node-version: 24/u);
  assert.match(combined, /actions\/cache@v6/u);
  assert.match(combined, /supabase\/setup-cli@v3/u);
  assert.match(combined, /denoland\/setup-deno@v2/u);
});

test('Edge Functions avoid the Supabase JS Node-version shim', async () => {
  const edgeFiles = await listFiles('supabase/functions');
  const edgeSource = (await Promise.all(
    edgeFiles.map((file) => readFile(file, 'utf8')),
  )).join('\n');
  const databaseClient = await read('supabase/functions/_shared/database-client.ts');
  const integrationScript = await read('scripts/verify-integration-local.sh');

  const supabaseJsImports = edgeSource
    .split(/\r?\n/u)
    .filter((line) => line.includes('npm:@supabase/supabase-js'));
  assert.ok(supabaseJsImports.every((line) => line.trimStart().startsWith('import type ')));
  assert.match(databaseClient, /npm:@supabase\/postgrest-js@2\.110\.7/u);
  assert.match(databaseClient, /APP_SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(integrationScript, /-X OPTIONS[\s\S]*backendAction/u);
  assert.match(
    integrationScript,
    /DENO_FALLBACK[\s\S]*node_modules\/\.bin[\s\S]*type -aP deno/u,
  );
  assert.match(
    integrationScript,
    /test --help[\s\S]*--minimum-dependency-age[\s\S]*DENO_DEPENDENCY_AGE_ARGS/u,
  );
  assert.doesNotMatch(
    integrationScript,
    /--data ['"][^'"]*integrationReadinessProbe/u,
  );
});

test('private database functions pin their search path without opening private tables', async () => {
  const migration = await read(
    'supabase/migrations/202607230002_security_advisor_function_paths.sql',
  );
  const functionNames = [
    'firebase_project_id',
    'firebase_uid',
    'issue_list_sort_date',
    'issue_user_sort_date',
    'refresh_announcement_comment_count',
    'refresh_announcement_like_count',
    'set_issue_derived_fields',
    'skip_duplicate_active_deletion_job',
    'skip_identical_outbox_update',
    'touch_updated_at',
    'validate_announcement_comment_parent',
    'validate_comment_parent',
  ];

  for (const functionName of functionNames) {
    assert.match(
      migration,
      new RegExp(
        `alter function app_private\\.${functionName}\\([\\s\\S]*?set search_path = pg_catalog, app_private;`,
        'u',
      ),
    );
  }
  assert.match(
    migration,
    /revoke all on table[\s\S]*app_private\.access_assignment_audit[\s\S]*app_private\.facility_categories[\s\S]*from public, anon, authenticated;/u,
  );
  assert.doesNotMatch(migration, /create policy|grant (select|insert|update|delete)/iu);
});

test('permission scopes and feature routes use the tested pure policy boundaries', async () => {
  const session = await read('src/composables/useSession.ts');
  const defaultRoute = await read('src/router/default-route.ts');
  const accessMatrix = await read('tests/unit/access-control-matrix.test.ts');
  const actionMatrix = await read('tests/unit/permission-actions-matrix.test.ts');
  const workflowMatrix = await read('tests/unit/category-access-workflows.test.ts');
  const accessIntegration = (
    await Promise.all([
      read('tests/integration/access/access-role-uploads.case.ts'),
      read('tests/integration/access/access-revocation.case.ts'),
      read('tests/integration/access/category-management.case.ts'),
      read('tests/integration/access/category-deletion.case.ts'),
    ])
  ).join('\n');

  assert.match(session, /from '@\/lib\/session-access'/u);
  assert.match(session, /canManageIssueCategory\(accessPolicy\.value, categoryId\)/u);
  assert.match(session, /canManageFacilityCategory\(accessPolicy\.value, categoryId\)/u);
  assert.match(defaultRoute, /getDefaultFeatureRoute/u);
  assert.match(defaultRoute, /isRouteEnabledByFeatures/u);
  assert.match(accessMatrix, /feature-switch routing matrix/u);
  assert.match(actionMatrix, /proposal detail permission actions/u);
  assert.match(actionMatrix, /facility detail permission actions/u);
  assert.match(workflowMatrix, /category workflow controls/u);
  assert.match(workflowMatrix, /member access controls/u);
  assert.match(accessIntegration, /revoking each access scope immediately removes its reads, writes, and assignment listing/u);
});

test('real browser E2E is isolated, complete, and enforced by CI', async () => {
  const [
    packageJson,
    playwrightConfig,
    integrationRunner,
    testBridge,
    bootstrap,
    visibility,
    actions,
    revocation,
    switches,
    categories,
    mobile,
    workflow,
  ] = await Promise.all([
    read('package.json'),
    read('playwright.config.ts'),
    read('scripts/verify-integration-local.sh'),
    read('src/testing/e2e-auth.ts'),
    read('tests/e2e/bootstrap.setup.ts'),
    read('tests/e2e/access-visibility.spec.ts'),
    read('tests/e2e/action-behavior.spec.ts'),
    read('tests/e2e/scope-revocation.spec.ts'),
    read('tests/e2e/feature-switches.spec.ts'),
    read('tests/e2e/category-workflows.spec.ts'),
    read('tests/e2e/mobile-access.spec.ts'),
    read('.github/workflows/verify-pr.yml'),
  ]);

  assert.match(packageJson, /"test:e2e": "node scripts\/verify-integration-local\.mjs --e2e"/u);
  assert.match(packageJson, /"verify:all": "node scripts\/run-local-verification\.mjs --all"/u);
  assert.match(playwrightConfig, /chromium-desktop/u);
  assert.match(playwrightConfig, /chromium-mobile/u);
  assert.match(integrationRunner, /E2E="true"/u);
  assert.match(integrationRunner, /VITE_NPM\[@\].*run --silent test:e2e:runner/u);
  assert.match(testBridge, /import\.meta\.env\.DEV/u);
  assert.match(testBridge, /integration\.invalid/u);
  assert.match(testBridge, /localEmulator/u);
  assert.match(bootstrap, /completeInitialSetup/u);
  assert.match(bootstrap, /storageState\(\{ indexedDB: true/u);
  assert.match(visibility, /controls follow ownership, category scope/u);
  assert.match(actions, /clipboard/u);
  assert.match(actions, /delete/u);
  assert.match(revocation, /reload/u);
  assert.match(switches, /issuesEnabled/u);
  assert.match(switches, /facilitiesEnabled/u);
  assert.match(categories, /rename/u);
  assert.match(mobile, /mobile/u);
  assert.match(workflow, /playwright install --with-deps chromium/u);
  assert.match(workflow, /npm run test:e2e/u);
});
