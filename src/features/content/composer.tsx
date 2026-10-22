import * as React from "react";
import { ArrowUp } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { INPUT_LIMITS } from "@/constants/input-limits";
import { hasComposerDraft } from "@/lib/composer-draft";
import { cn } from "@/lib/utils";
import type { useComposerDraft } from "@/hooks/use-composer-draft";
import type { useImageAttachments } from "@/hooks/use-image-attachments";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Input } from "@/ui/field";
import { AddImagesButton, AttachmentGrid } from "./attachments";
import { MarkdownEditor } from "./markdown-editor";

/** A label with a running count against its limit. */
export function CountedLabel({ count, htmlFor, id, label, limit }: { count: number; htmlFor?: string; id?: string; label: string; limit: number }) {
  return (
    <div className="flex items-center justify-between px-1">
      <label className="text-sm font-medium text-ink-muted" htmlFor={htmlFor}>{label}</label>
      <span className={cn("text-xs tabular-nums", count > limit ? "font-medium text-danger" : "text-ink-faint")} id={id}>{count} / {limit}</span>
    </div>
  );
}

function DraftNotice({ draft }: { draft: ReturnType<typeof useComposerDraft> }) {
  const { t } = useI18n();
  const [clearing, setClearing] = React.useState(false);
  const stored = hasComposerDraft(draft.value);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-0 flex-1 text-sm text-ink-faint" role="status">
        {t(draft.restored ? "ui.composer.draftRestored" : draft.saved ? "ui.composer.draftSaved" : stored ? "ui.composer.draftUnavailable" : "ui.composer.draftHint")}
      </p>
      {stored ? (
        <ConfirmDialog
          confirmLabel={t("ui.composer.clearDraft")}
          description={t("ui.composer.clearDraftDescription")}
          onConfirm={() => { draft.clear(); setClearing(false); }}
          onOpenChange={setClearing}
          open={clearing}
          title={t("ui.composer.clearDraft")}
          tone="danger"
          trigger={<Button size="sm" variant="ghost">{t("ui.composer.clearDraft")}</Button>}
        />
      ) : null}
    </div>
  );
}

interface TextField {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

/**
 * Writing a new record: a title, a body in the markdown editor, any images,
 * and send. `children` holds fields particular to one kind of record, set
 * above the title. The draft is saved as it is written.
 */
export function Composer({ body, busy, children, draft, images, onSubmit, submitBusyLabel, submitDisabled, submitLabel, succeeded, titleField }: {
  body: TextField;
  busy: boolean;
  children?: React.ReactNode;
  draft: ReturnType<typeof useComposerDraft>;
  images: ReturnType<typeof useImageAttachments>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitBusyLabel: string;
  submitDisabled: boolean;
  submitLabel: string;
  succeeded: boolean;
  titleField: TextField;
}) {
  const { t } = useI18n();
  // One composer is on screen at a time, so its fields keep stable ids.
  const id = "composer";
  return (
    <form className="grid gap-6" data-update-defer="true" onSubmit={onSubmit}>
      <fieldset className="grid min-w-0 gap-6" disabled={busy} inert={busy}>
        {children}
        <div className="grid gap-2">
          <CountedLabel count={titleField.value.length} htmlFor={`${id}-title`} label={titleField.label} limit={INPUT_LIMITS.title} />
          <Input
            id={`${id}-title`}
            maxLength={INPUT_LIMITS.title}
            onChange={(event) => titleField.onChange(event.target.value)}
            placeholder={titleField.placeholder}
            value={titleField.value}
          />
        </div>
        <div className="grid min-w-0 gap-2">
          <CountedLabel count={body.value.length} htmlFor={"composer-content"} id={"composer-content-count"} label={body.label} limit={INPUT_LIMITS.content} />
          <MarkdownEditor
            ariaDescribedBy={"composer-content-count"}
            ariaLabel={body.label}
            content={body.value}
            id={"composer-content"}
            maxLength={INPUT_LIMITS.content}
            onChange={body.onChange}
            onPickImages={images.maxImages > 0 ? (files) => void images.pick(files) : undefined}
            placeholder={body.placeholder}
          />
          {body.value.length > INPUT_LIMITS.content ? (
            <p className="px-1 text-sm text-danger" role="alert">{t("markdown.contentTooLong", { count: INPUT_LIMITS.content })}</p>
          ) : null}
        </div>
        {images.maxImages > 0 || images.images.length > 0 ? (
          <div className="grid gap-3">
            <AddImagesButton count={images.images.length} maxImages={images.maxImages} onPick={(files) => void images.pick(files)} uploading={images.uploading} />
            <AttachmentGrid attachments={images.images} onRemove={images.remove} uploading={images.uploading} />
          </div>
        ) : null}
      </fieldset>
      <DraftNotice draft={draft} />
      <Button className="w-full sm:w-auto sm:justify-self-end" disabled={submitDisabled} size="lg" status={busy ? (succeeded ? "success" : "loading") : "idle"} type="submit" variant="primary">
        {busy ? null : <ArrowUp weight="bold" />}
        {busy ? submitBusyLabel : submitLabel}
      </Button>
    </form>
  );
}
