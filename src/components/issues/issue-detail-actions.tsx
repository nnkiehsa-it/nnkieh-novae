"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Clock3, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { IssueRecord } from "@/types";
import type { getIssueOperationTimeItems } from "@/lib/issue-timeline";
import { formatDate } from "@/lib/format";
import { shareCurrentPage } from "@/lib/share";
import { DetailToolbar } from "@/components/detail-toolbar";
import { DetailActionsMenu } from "@/components/detail-actions-menu";
import { IssueSupportPanel } from "@/components/issues/issue-support-panel";
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
  if (issue.support_enabled) panels.push({
    key: "reaction",
    content: <IssueSupportPanel
      burst={burst}
      canViewSupporters={canViewSupporters}
      issue={issue}
      onLoadSupporters={onLoadSupporters}
      onSupport={onSupport}
      reveal={reveal}
      supportOpen={supportOpen}
      supportProgress={supportProgress}
      supporters={supporters}
      supportersError={supportersError}
      supportersLoading={supportersLoading}
      supporting={supporting}
    />,
  });
  panels.push({ key: "timeline", content: <div className="grid gap-5">
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
  </div> });
  return panels;
}
