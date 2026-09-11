"use client";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { ComposerField } from "@/components/composer-fields";
import { ComposerLayout } from "@/components/composer-layout";
import { FacilityComposerFields } from "@/components/facilities/facility-composer-fields";

export type ComposerSkeletonKind = "announcement" | "facility" | "issue";

const titleKeys = {
  announcement: "ui.announcement.newTitle",
  facility: "ui.facility.newTitle",
  issue: "ui.issue.newTitle",
} as const;

const submitKeys = {
  announcement: "ui.announcement.publish",
  facility: "ui.facility.submit",
  issue: "ui.issue.submit",
} as const;

const titleLabelKeys = {
  announcement: "ui.announcement.titleLabel",
  facility: "ui.facility.reportTitle",
  issue: "ui.issue.titleLabel",
} as const;

const contentLabelKeys = {
  announcement: "ui.announcement.contentLabel",
  facility: "ui.facility.problemDescription",
  issue: "ui.issue.contentLabel",
} as const;

/**
 * A composer route while its own chunk is still arriving.
 *
 * It is the real composer in its pending state, never a drawing of one. That is
 * the only way the two states occupy the same geometry down to the character
 * counters, and the handoff between them is a crossfade in place with nowhere
 * to hide a jump.
 */
export function ComposerRouteSkeleton({
  extraFields = false,
  kind = "issue",
}: {
  extraFields?: boolean;
  kind?: ComposerSkeletonKind;
}) {
  useLocaleSubscription();
  const submitLabel = translate(submitKeys[kind]);
  return (
    <ComposerLayout
      onBack={() => window.history.back()}
      onSubmit={(event) => event.preventDefault()}
      submitBusyLabel={submitLabel}
      submitDisabled
      submitLabel={submitLabel}
      title={translate(titleKeys[kind])}
    >
      {extraFields ? (
        <FacilityComposerFields
          categories={[]}
          category=""
          location=""
          onCategoryChange={() => undefined}
          onLocationChange={() => undefined}
          pending
        />
      ) : null}
      <ComposerField
        attachments={[]}
        attachmentsUploading={false}
        content=""
        contentLabel={translate(contentLabelKeys[kind])}
        onContentChange={() => undefined}
        onPickImages={() => undefined}
        onRemoveImage={() => undefined}
        onTitleChange={() => undefined}
        pending
        placeholder=""
        title=""
        titleLabel={translate(titleLabelKeys[kind])}
        titlePlaceholder=""
      />
    </ComposerLayout>
  );
}
