"use client";

import * as React from "react";
import { DotsThree, ShareNetwork, Trash } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { shareCurrentPage } from "@/lib/share";
import { Button, type ActionStatus } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Skeleton } from "@/ui/feedback";
import { Menu, type MenuItem } from "@/ui/menu";
import { ErrorState } from "@/ui/page";
import { Tooltip } from "@/ui/popover";

export interface RecordAction {
  icon: Icon;
  label: string;
  onSelect: () => void;
}

/** Share, and behind the menu whatever else this reader may do, ending in deletion. */
export function RecordActions({ items = [], remove, shareTitle }: {
  items?: RecordAction[];
  remove?: { description: string; label: string; onConfirm: () => void; status: ActionStatus; title: string };
  shareTitle: string;
}) {
  const { t } = useI18n();
  const [confirming, setConfirming] = React.useState(false);
  const share = () =>
    void shareCurrentPage(shareTitle)
      .then((result) => { if (result === "copied") toast.success(t("ui.common.linkCopied")); })
      .catch(() => toast.error(t("ui.common.shareFailed")));
  const menuItems: MenuItem[] = [
    ...items.map(({ icon, label, onSelect }) => ({ icon, key: label, label, onSelect })),
    ...(remove ? [{ icon: Trash, key: "remove", label: remove.label, onSelect: () => setConfirming(true), tone: "danger" as const }] : []),
  ];
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip label={t("common.share")}>
        <Button aria-label={t("common.share")} onClick={share} size="icon-sm" variant="ghost"><ShareNetwork /></Button>
      </Tooltip>
      {menuItems.length ? (
        <Menu
          items={menuItems}
          title={t("ui.common.moreActions")}
          trigger={<Button aria-label={t("ui.common.moreActions")} size="icon-sm" variant="ghost"><DotsThree weight="bold" /></Button>}
        />
      ) : null}
      {remove ? (
        <ConfirmDialog
          confirmLabel={t("ui.common.confirmDelete")}
          description={remove.description}
          onConfirm={remove.onConfirm}
          onOpenChange={setConfirming}
          open={confirming}
          status={remove.status}
          title={remove.title}
          tone="danger"
        />
      ) : null}
    </div>
  );
}

/**
 * The head of a record: chips naming its kind and state, its actions, then
 * its title and the line under it.
 */
export function RecordHeader({ actions, chips, meta, title }: {
  actions?: React.ReactNode;
  chips?: React.ReactNode;
  meta?: React.ReactNode;
  title: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <header className="grid gap-4">
      <div className="flex min-h-9 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{chips}</div>
        {actions}
      </div>
      <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight md:text-[1.75rem]">{title}</h1>
      {meta ? <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-muted">{meta}</div> : null}
    </header>
  );
}

/** A record's shape while it loads. */
export function RecordSkeleton() {
  const { t } = useI18n();
  return (
    <div aria-busy="true" aria-label={t("common.loading")} className="grid gap-6" role="status">
      <div className="flex gap-2"><Skeleton className="h-8 w-20 rounded-chip" /><Skeleton className="h-8 w-16 rounded-chip" /></div>
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-40" />
      <div className="grid gap-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-2/3" /></div>
    </div>
  );
}

/** A record that could not be shown; the sheet around it is still the way back. */
export function RecordError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n();
  return <ErrorState message={message} onRetry={onRetry} retryLabel={t("ui.common.reload")} title={t("ui.common.loadFailed")} />;
}
