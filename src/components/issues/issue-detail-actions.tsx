"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Clock3, ShieldCheck } from "lucide-react";
import { Icon } from "framework7-react";
import { toast } from "@/lib/toast";
import type { IssueRecord } from "@/types";
import type { getIssueOperationTimeItems } from "@/lib/issue-timeline";
import { Timeline } from "@/components/ui/timeline";
import { formatDate } from "@/lib/format";
import { shareCurrentPage } from "@/lib/share";
import { DetailToolbar } from "@/components/detail-toolbar";
import { DetailActionsMenu } from "@/components/detail-actions-menu";
import { IssueSupportPanel } from "@/components/issues/issue-support-panel";
import type { DetailPanel } from "@/components/ui/detail-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";
import { ToolbarButton } from "@/components/ui/toolbar-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-controls";

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
              <Popover><PopoverTrigger asChild><ToolbarButton aria-label={translate('issue.showAuthor')}><Icon f7="eye" aria-hidden /></ToolbarButton></PopoverTrigger>
                <PopoverContent title={translate('issue.showAuthor')}>
                  <ListSection><ListSwitchRow checked={authorVisible} label={translate('issue.showAuthor')}
                    name={translate('issue.showAuthor')} onCheckedChange={onAuthorVisibilityChange} /></ListSection>
                </PopoverContent>
              </Popover>
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
        <Timeline items={timeline.map(item => ({
          key: item.label,
          title: <SkeletonReveal enabled={reveal} skeleton={<Skeleton className="h-4 w-20" />}>{translate(item.shortLabel)}</SkeletonReveal>,
          content: <SkeletonReveal enabled={reveal} skeleton={<Skeleton className="h-4 w-28" />}><time dateTime={item.value.toISOString()}>{formatDate(item.value)}</time></SkeletonReveal>,
        }))} />
  </div> });
  return panels;
}
