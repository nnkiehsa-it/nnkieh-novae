"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Check } from "lucide-react";
import type { IssueRecord, UserPublicProfile } from "@/types";
import { getIssueCategoryLabel } from "@/constants/categories";
import { formatDate } from "@/lib/format";
import { ContentRenderer } from "@/components/content-renderer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export function IssueDetailContent({
  issue,
  profile,
  status,
}: {
  issue: IssueRecord;
  profile: UserPublicProfile | null;
  status: IssueRecord["status"];
}) {
  useLocaleSubscription();
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="border-b px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6">
        <div className="t-data-content-enter flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-[var(--shadow-control)]">
            {getIssueCategoryLabel(issue.category)}
          </span>
          <StatusBadge domain="issue" status={status} />
        </div>
        <h1 className="t-data-content-enter mt-3 text-balance text-2xl font-semibold leading-8 sm:text-[1.75rem] sm:leading-9">
          {issue.title}
        </h1>
        <div className="t-data-content-enter mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-muted-foreground">
          <span>{formatDate(issue.created_at)}</span>
          {issue.canViewAuthor ? (
            <span className="inline-flex items-center gap-1.5">
              <Avatar className="size-5">
                <AvatarImage
                  alt={profile?.displayName ?? translate('ui.issue.author')}
                  src={profile?.photoUrl ?? undefined}
                />
                <AvatarFallback>
                  {profile?.displayName?.slice(0, 1) || "?"}
                </AvatarFallback>
              </Avatar>
              {profile?.displayName || translate('ui.common.schoolMember')}
            </span>
          ) : null}
        </div>
      </div>
      <CardContent className="py-5 sm:px-7 sm:py-6">
        <ContentRenderer
          content={issue.content}
          fallbackAlt={issue.title}
          textClassName="t-data-content-enter"
        />
      </CardContent>
      {issue.result_content ? (
        <div className="border-t bg-emerald-500/[0.045] px-5 py-5 sm:px-7">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-success">
            <span
              className="t-success-check grid size-6 place-items-center rounded-full bg-success/12"
              data-state="in"
            >
              <Check className="size-3.5" />
            </span>{translate('ui.common.result')}</div>
          <ContentRenderer
            content={issue.result_content}
            fallbackAlt={translate('ui.issue.resultAlt', { title: issue.title })}
            textClassName="t-data-content-enter"
          />
        </div>
      ) : null}
    </Card>
  );
}
