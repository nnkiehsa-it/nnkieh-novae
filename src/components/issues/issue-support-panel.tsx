"use client";

import { motion } from "motion/react";
import { Hand, RefreshCw } from "lucide-react";
import { t } from "@/i18n";
import type { IssueRecord } from "@/types";
import { timing } from "@/lib/motion-timing";
import { PersonIdentity } from "@/components/content-author";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { Button } from "@/components/ui/button";
import { SheetRow } from "@/components/ui/sheet-row";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";

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
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.span
            animate={{ scaleX: supportProgress / 100 }}
            className="block h-full origin-left rounded-full bg-tint-content"
            initial={false}
            transition={timing("sheet")}
          />
        </div>
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
          <div className="min-w-0">
            <SheetRow
              label={t("ui.issue.supporters")}
              onOpenChange={(open) => { if (open) onLoadSupporters(); }}
              title={t("ui.issue.supporters")}
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
                  <span className="text-xs text-muted-foreground">{t("ui.common.loadFailed")}</span>
                  <Button onClick={onLoadSupporters} size="sm" variant="ghost">
                    <RefreshCw />{t("ui.common.reload")}
                  </Button>
                </div>
              ) : (
                <div className="rule-list">
                  {supporters.map((supporter) => (
                    <div className="flex min-h-11 items-center py-2.5" key={supporter.uid}>
                      <PersonIdentity name={supporter.displayName} photoUrl={supporter.photoUrl} />
                    </div>
                  ))}
                </div>
              )}
            </SheetRow>
          </div>
        ) : null}
      </div>
    </div>
  );
}
