"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { motion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import { Clock3, ShieldCheck, Hand, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { IssueRecord } from "@/types";
import type { getIssueOperationTimeItems } from "@/lib/issue-timeline";
import { formatDate } from "@/lib/format";
import { shareCurrentPage } from "@/lib/share";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { DetailToolbar } from "@/components/detail-toolbar";
import { DetailActionsMenu } from "@/components/detail-actions-menu";
import { PersonIdentity } from "@/components/content-author";
import { Button } from "@/components/ui/button";
import { SheetRow } from "@/components/ui/sheet-row";
import type { DetailPanel } from "@/components/ui/detail-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";
import { Switch } from "@/components/ui/switch";

export function IssueDetailToolbar({
  authorVisible,
  canManage,
  issue,
  deleteFeedbackState,
  onAuthorVisibilityChange,
  onBack,
  onDelete,
  onManage,
}: {
  authorVisible: boolean;
  canManage: boolean;
  issue: IssueRecord;
  deleteFeedbackState: "idle" | "loading" | "success";
  onAuthorVisibilityChange: (visible: boolean) => void;
  onBack: () => void;
  onDelete: () => void;
  onManage: () => void;
}) {
  useLocaleSubscription();
  return (
    <DetailToolbar
      actions={
        issue.canDeleteIssue || canManage ? (
          <>
            {canManage && issue.canViewAuthor ? (
              <label className="flex h-11 shrink-0 cursor-pointer items-center gap-2 px-2 text-xs font-medium text-muted-foreground md:h-9">
                <span>{translate('issue.showAuthor')}</span>
                <Switch
                  checked={authorVisible}
                  onCheckedChange={onAuthorVisibilityChange}
                  size="sm"
                />
              </label>
            ) : null}
            <DetailActionsMenu
              items={
                canManage
                  ? [
                      {
                        icon: ShieldCheck,
                        label: translate('ui.issue.manageStatus'),
                        onSelect: onManage,
                      },
                    ]
                  : []
              }
              remove={{
                description: translate('ui.issue.deleteDescription'),
                label: translate('ui.issue.delete'),
                onConfirm: onDelete,
                state: deleteFeedbackState,
                title: translate('ui.issue.deleteTitle'),
              }}
            />
          </>
        ) : null
      }
      backLabel={translate('ui.issue.back')}
      onBack={onBack}
      onShare={() =>
            void shareCurrentPage(issue.title)
              .then((result) => {
                if (result === "copied") toast.success(translate('ui.common.linkCopied'));
              })
              .catch(() => toast.error(translate('ui.common.shareFailed')))
      }
      shareLabel={translate('ui.issue.share')}
    />
  );
}

export function getIssueDetailPanels({
  burst,
  canViewSupporters,
  issue,
  onLoadSupporters,
  onSupport,
  reveal,
  supportOpen,
  supportProgress,
  supporters,
  supportersError,
  supportersLoading,
  supporting,
  timeline,
}: {
  burst: number;
  canViewSupporters: boolean;
  issue: IssueRecord;
  onLoadSupporters: () => void;
  onSupport: () => void;
  reveal: boolean;
  supportOpen: boolean;
  supportProgress: number;
  supporters: Array<{ uid: string; displayName: string; photoUrl: string | null }>;
  supportersError: string;
  supportersLoading: boolean;
  supporting: boolean;
  timeline: ReturnType<typeof getIssueOperationTimeItems>;
}) {
  const panels: DetailPanel[] = [];
  if (issue.support_enabled) panels.push({ key: "reaction", className: "gap-0 overflow-hidden p-0", content: <>
          <div className="grid gap-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-medium">{translate('ui.issue.supportProgress')}</p>
            <SkeletonReveal enabled={reveal} skeleton={<Skeleton className="h-5 w-14" />}><p className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">
              <AnimatedNumber value={issue.support_count} />
              {issue.support_goal ? ` / ${issue.support_goal}` : ""}
            </p></SkeletonReveal>
          </div>
          {issue.support_goal ? (
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <motion.span
                animate={{ scaleX: supportProgress / 100 }}
                className="block h-full origin-left rounded-full bg-tint-content"
                initial={false}
                transition={timing("sheet")}
              />
            </div>
          ) : null}
          <div className="flex items-center justify-center">
            <LikeActionButton
              active={issue.currentUserSupported === true}
              burst={burst}
              busy={supporting}
              className="size-11"
              disabled={issue.isOwnIssue || !supportOpen}
              icon={Hand}
              inactiveVariant="secondary"
              label={
                issue.isOwnIssue
                  ? translate("ui.issue.ownSupport")
                  : issue.currentUserSupported
                    ? translate('ui.issue.cancelSupport')
                  : supportOpen
                    ? translate('ui.issue.support')
                    : translate('ui.issue.supportClosed')
              }
              onClick={onSupport}
            />
          </div>
          </div>
          {canViewSupporters ? (
            <div className="border-t border-border px-[var(--row-gutter)]">
              <SheetRow
                label={translate("ui.issue.supporters")}
                onOpenChange={(open) => { if (open) onLoadSupporters(); }}
                title={translate("ui.issue.supporters")}
              >
                {supportersLoading ? (
                  <div aria-busy="true" className="rule-list">
                    {Array.from({ length: 4 }, (_, index) => (
                      <div className="flex min-h-11 items-center gap-2.5 py-2.5" key={index}>
                        <Skeleton className="size-8 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                ) : supportersError ? (
                  <div className="flex min-h-11 items-center justify-between gap-3 py-2.5">
                    <span className="text-xs text-muted-foreground">
                      {translate("ui.common.loadFailed")}
                    </span>
                    <Button onClick={onLoadSupporters} size="sm" variant="ghost">
                      <RefreshCw />
                      {translate("ui.common.reload")}
                    </Button>
                  </div>
                ) : (
                  <div className="rule-list">
                    {supporters.map((supporter) => (
                      <div className="flex min-h-11 items-center py-2.5" key={supporter.uid}>
                        <PersonIdentity
                          name={supporter.displayName}
                          photoUrl={supporter.photoUrl}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </SheetRow>
            </div>
          ) : null}
  </> });
  panels.push({ key: "timeline", className: "gap-5", content: <>
        <div className="flex items-center gap-2">
          <Clock3 className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">{translate('ui.issue.timeline')}</p>
        </div>
        <div className="grid gap-0">
          {timeline.map((item, index) => (
            <div
              className="relative grid grid-cols-[1rem_1fr] gap-2 pb-4 last:pb-0"
              key={item.label}
            >
              <div className="flex flex-col items-center">
                <span className="mt-1 size-2 rounded-full bg-foreground" />
                {index < timeline.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-border" />
                ) : null}
              </div>
              <SkeletonReveal as="div" enabled={reveal} skeleton={<div className="space-y-1.5"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-28" /></div>}>
                <div>
                  <p className="text-[0.8125rem] font-medium">{translate(item.shortLabel)}</p>
                  <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                    {formatDate(item.value)}
                  </p>
                </div>
              </SkeletonReveal>
            </div>
          ))}
        </div>
  </> });
  return panels;
}
