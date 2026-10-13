"use client";

import { CalendarBlank, ChatCircle, HandHeart } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import type { IssueSummary, UserPublicProfile } from "@/types";
import { getIssueCategoryLabel } from "@/constants/categories";
import { formatDateOnly, formatRelativeTime } from "@/lib/format";
import { getDerivedIssueStatus, getSupportProgressPercent } from "@/lib/issue-status";
import { Author } from "@/features/content/person";
import { ReactionButton } from "@/features/content/reaction";
import { StatusChip } from "@/features/content/status";
import { CardProgress, RecordCard } from "@/features/feed/record-card";
import { AnimatedNumber } from "@/ui/animated-number";
import { Chip } from "@/ui/chip";

export function IssueCard({ burst, filter, issue, onSupport, profile, showCategory, supporting }: {
  burst: number;
  filter: string;
  issue: IssueSummary;
  onSupport: () => void;
  profile?: UserPublicProfile;
  /** Lists that mix categories name each card's own. */
  showCategory: boolean;
  supporting: boolean;
}) {
  const { t } = useI18n();
  const goal = issue.support_goal;
  const authorShown = issue.canViewAuthor && issue.author_uid;
  return (
    <RecordCard
      chips={
        <>
          <StatusChip domain="issue" status={getDerivedIssueStatus(issue)} />
          {showCategory ? <Chip>{getIssueCategoryLabel(issue.category)}</Chip> : null}
        </>
      }
      footer={
        <>
          {issue.support_enabled ? (
            <ReactionButton
              active={issue.currentUserSupported === true}
              burst={burst}
              busy={supporting}
              count={issue.support_count}
              disabled={issue.isOwnIssue || !["pending", "processing"].includes(issue.status)}
              icon={HandHeart}
              label={t(issue.isOwnIssue ? "ui.issue.ownSupport" : issue.currentUserSupported ? "ui.issue.cancelSupport" : "ui.issue.support")}
              onClick={onSupport}
            />
          ) : null}
          {issue.comments_enabled ? <ChatCircle aria-hidden className="ml-auto size-5 text-ink-faint" /> : null}
        </>
      }
      href={`/issues/${encodeURIComponent(filter)}/${issue.id}`}
      label={issue.title}
      meta={
        <>
          {authorShown ? <Author profile={profile} /> : null}
          {authorShown ? <span aria-hidden>·</span> : null}
          <span>{formatRelativeTime(issue.review_approved_at ?? issue.created_at)}</span>
        </>
      }
      title={issue.title}
    >
      {issue.support_enabled && goal ? (
        <CardProgress value={getSupportProgressPercent(issue.support_count, goal)}>
          <div className="flex items-center justify-between gap-2 text-sm text-ink-muted">
            {issue.support_deadline_at ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <CalendarBlank className="size-4 shrink-0" />
                <span className="truncate">{t("ui.issue.supportEndsOn", { date: formatDateOnly(issue.support_deadline_at) })}</span>
              </span>
            ) : <span>{t("ui.issue.supportProgress")}</span>}
            <span className="font-semibold tabular-nums text-ink"><AnimatedNumber value={issue.support_count} /> / {goal}</span>
          </div>
        </CardProgress>
      ) : null}
    </RecordCard>
  );
}
