"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { motion } from "motion/react";
import {
  ArrowLeft,
  Clock3,
  MoreHorizontal,
  Share2,
  ShieldCheck,
  Hand,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { IssueRecord } from "@/types";
import type { getIssueOperationTimeItems } from "@/lib/issue-timeline";
import { formatDate } from "@/lib/format";
import { shareCurrentPage } from "@/lib/share";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function IssueDetailToolbar({
  issue,
  onBack,
  onDelete,
  onManage,
}: {
  issue: IssueRecord;
  onBack: () => void;
  onDelete: () => void;
  onManage: () => void;
}) {
  useLocaleSubscription();
  return (
    <div className="flex items-center justify-between gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button aria-label={translate('ui.issue.back')} onClick={onBack} size="icon" variant="ghost">
            <ArrowLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{translate('ui.issue.back')}</TooltipContent>
      </Tooltip>
      <div className="flex items-center gap-1">
        <Button
          aria-label={translate('ui.issue.share')}
          onClick={() =>
            void shareCurrentPage(issue.title)
              .then((result) => {
                if (result === "copied") toast.success(translate('ui.common.linkCopied'));
              })
              .catch(() => toast.error(translate('ui.common.shareFailed')))
          }
          size="icon"
          variant="ghost"
        >
          <Share2 />
        </Button>
        {issue.isOwnIssue || issue.canManageIssue ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={translate('ui.common.moreActions')} size="icon" variant="ghost">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {issue.canManageIssue ? (
                <DropdownMenuItem onSelect={onManage}>
                  <ShieldCheck />{translate('ui.issue.manageStatus')}</DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={(event) => event.preventDefault()}
                  >
                    <Trash2 />{translate('ui.issue.delete')}</DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{translate('ui.issue.deleteTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>{translate('ui.issue.deleteDescription')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{translate('ui.common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>{translate('ui.common.confirmDelete')}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

export function IssueDetailSidebar({
  burst,
  issue,
  onSupport,
  supportOpen,
  supportProgress,
  supporting,
  timeline,
}: {
  burst: number;
  issue: IssueRecord;
  onSupport: () => void;
  supportOpen: boolean;
  supportProgress: number;
  supporting: boolean;
  timeline: ReturnType<typeof getIssueOperationTimeItems>;
}) {
  return (
    <aside className="space-y-3 lg:sticky lg:top-6">
      {issue.support_enabled ? (
        <Card className="gap-5 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{translate('ui.issue.supportProgress')}</p>
            <p className="text-sm font-semibold tabular-nums">
              <AnimatedNumber value={issue.support_count} />
              {issue.support_goal ? ` / ${issue.support_goal}` : ""}
            </p>
          </div>
          {issue.support_goal ? (
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <motion.span
                animate={{ scaleX: supportProgress / 100 }}
                className="block h-full origin-left rounded-full bg-foreground"
                initial={false}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          ) : null}
          <div className="flex justify-end">
            <LikeActionButton
              active={issue.currentUserSupported === true}
              burst={burst}
              busy={supporting}
              disabled={!supportOpen}
              icon={Hand}
              label={
                issue.currentUserSupported
                  ? translate('ui.issue.cancelSupport')
                  : supportOpen
                    ? translate('ui.issue.support')
                    : translate('ui.issue.supportClosed')
              }
              onClick={onSupport}
            />
          </div>
        </Card>
      ) : null}
      <Card className="gap-4 p-5 sm:p-6">
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
              <div>
                <p className="text-[0.8125rem] font-medium">{translate(item.shortLabel)}</p>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {formatDate(item.value)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </aside>
  );
}
