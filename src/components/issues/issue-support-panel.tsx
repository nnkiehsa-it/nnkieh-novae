"use client";

import { Hand, RefreshCw } from "lucide-react";
import { t } from "@/i18n";
import type { IssueRecord } from "@/types";
import { PersonIdentity } from "@/components/content-author";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { Button } from "@/components/ui/button";
import { SheetRow } from "@/components/ui/sheet-row";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";
import { ListCustomRow, ListSection } from "@/components/ui/list";
import { ProgressBar } from "@/components/ui/progress-bar";

interface IssueSupportPanelProps {
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
}

export function IssueSupportPanel({
  burst, canViewSupporters, issue, onLoadSupporters, onSupport, reveal,
  supportOpen, supportProgress, supporters, supportersError, supportersLoading, supporting,
}: IssueSupportPanelProps) {
  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{t("ui.issue.supportProgress")}</p>
        <SkeletonReveal enabled={reveal} skeleton={<Skeleton className="h-5 w-14" />}>
          <p className="whitespace-nowrap text-sm font-semibold tabular-nums">
            <AnimatedNumber value={issue.support_count} />
            {issue.support_goal ? ` / ${issue.support_goal}` : ""}
          </p>
        </SkeletonReveal>
      </div>
      {issue.support_goal ? (
        <ProgressBar label={t("ui.issue.supportProgress")} percent={supportProgress} />
      ) : null}
      <div className="grid gap-3">
        <div className="flex justify-center">
          <LikeActionButton
            active={issue.currentUserSupported === true}
            burst={burst}
            busy={supporting}
            className="size-11"
            disabled={issue.isOwnIssue || !supportOpen}
            icon={Hand}
            inactiveVariant="secondary"
            label={issue.isOwnIssue ? t("ui.issue.ownSupport")
              : issue.currentUserSupported ? t("ui.issue.cancelSupport")
              : supportOpen ? t("ui.issue.support") : t("ui.issue.supportClosed")}
            onClick={onSupport}
          />
        </div>
        {canViewSupporters ? (
          <ListSection>
            <SheetRow
              label={t("ui.issue.supporters")}
              onOpenChange={(open) => { if (open) onLoadSupporters(); }}
              title={t("ui.issue.supporters")}
            >
              {supportersLoading ? (
                <ListSection>
                  {Array.from({ length: 4 }, (_, index) => (
                    <ListCustomRow className="flex items-center gap-2.5" key={index}>
                      <Skeleton className="size-8 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </ListCustomRow>
                  ))}
                </ListSection>
              ) : supportersError ? (
                <div className="flex min-h-11 items-center justify-between gap-3 py-2.5">
                  <span className="text-xs text-muted-foreground">{t("ui.common.loadFailed")}</span>
                  <Button onClick={onLoadSupporters} size="sm" variant="ghost">
                    <RefreshCw />{t("ui.common.reload")}
                  </Button>
                </div>
              ) : (
                <ListSection>
                  {supporters.map((supporter) => (
                    <ListCustomRow key={supporter.uid}>
                      <PersonIdentity name={supporter.displayName} photoUrl={supporter.photoUrl} />
                    </ListCustomRow>
                  ))}
                </ListSection>
              )}
            </SheetRow>
          </ListSection>
        ) : null}
      </div>
    </div>
  );
}
