"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import {
  LoaderCircle,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import {
  type AccessScope,
  type AccessUser,
  useAccessManagement,
} from "@/hooks/use-access-management";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/page-state";
import { Input } from "@/components/ui/input";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AccessManagement() {
  useLocaleSubscription();
  const {
    candidate,
    categoryId,
    error,
    hasScope,
    kind,
    load,
    loading,
    members,
    options,
    query,
    save,
    savingUid,
    successUid,
    search,
    searching,
    setCategoryId,
    setKind,
    setQuery,
    scope,
  } = useAccessManagement();
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{translate('ui.access.scopeStep')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <LiquidTabs
            ariaLabel={translate('ui.access.scopeType')}
            onValueChange={(value) => setKind(value as AccessScope["kind"])}
            options={[
              { label: translate('ui.access.issueCategory'), value: "issue" },
              { label: translate('ui.access.facilityCategory'), value: "facility" },
              { label: translate('ui.access.announcementManagement'), value: "announcement" },
            ]}
            value={kind}
          />
          {kind !== "announcement" ? (
            <Select onValueChange={setCategoryId} value={categoryId}>
              <SelectTrigger>
                <SelectValue placeholder={translate('ui.access.selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </CardContent>
      </Card>
      {scope ? (
        <>
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-base">{translate('ui.access.currentStep')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4">
                  <LoadingState rows={2} />
                </div>
              ) : error ? (
                <div className="p-4">
                  <ErrorState error={error} onRetry={() => void load()} />
                </div>
              ) : members.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    description={translate('ui.access.noneDescription')}
                    title={translate('ui.access.noneTitle')}
                  />
                </div>
              ) : (
                <div className="divide-y">
                  {members.map((member) => (
                    <MemberRow
                      action={
                        <Button
                          disabled={Boolean(savingUid)}
                          onClick={() => void save(member, false)}
                          size="sm"
                          variant="outline"
                        >
                          {savingUid === member.uid ? (
                            <ActionFeedbackIcon
                              className="bg-transparent [&>svg]:size-5"
                              size="md"
                              state={successUid === member.uid ? "success" : "loading"}
                            />
                          ) : (
                            <Trash2 />
                          )}{translate('ui.access.revoke')}</Button>
                      }
                      key={member.uid}
                      member={member}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{translate('ui.access.searchStep')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void search();
                    }}
                    placeholder={translate('ui.access.searchPlaceholder')}
                    value={query}
                  />
                </div>
                <Button
                  disabled={!query.trim() || searching}
                  onClick={() => void search()}
                  variant="outline"
                >
                  {searching ? (
                    <LoaderCircle className="t-spinner" />
                  ) : (
                    <Search />
                  )}{translate('ui.common.search')}</Button>
              </div>
              {candidate ? (
                <MemberRow
                  action={
                    <Button
                      disabled={Boolean(savingUid)}
                      onClick={() => void save(candidate, !hasScope(candidate))}
                      size="sm"
                      variant={hasScope(candidate) ? "outline" : "default"}
                    >
                      {savingUid === candidate.uid ? (
                        <ActionFeedbackIcon
                          className="bg-transparent [&>svg]:size-5"
                          size="md"
                          state={successUid === candidate.uid ? "success" : "loading"}
                        />
                      ) : hasScope(candidate) ? (
                        <Trash2 />
                      ) : (
                        <UserPlus />
                      )}
                      {hasScope(candidate) ? translate('ui.access.revoke') : translate('ui.access.grant')}
                    </Button>
                  }
                  member={candidate}
                />
              ) : (
                <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">{translate('ui.access.searchHint')}</div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          description={translate('ui.access.selectDescription')}
          title={translate('ui.access.selectTitle')}
        />
      )}
    </section>
  );
}

function MemberRow({
  action,
  member,
}: {
  action: React.ReactNode;
  member: AccessUser;
}) {
  const name = member.name || member.email || translate('ui.common.schoolMember');
  return (
    <div
      aria-label={member.email || name}
      className="flex items-center gap-3 p-4"
      role="group"
    >
      <Avatar className="size-9">
        <AvatarImage alt={name} src={member.photoUrl ?? undefined} />
        <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <SkeletonReveal as="div" className="min-w-0 flex-1" skeleton={<div className="space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-44" /></div>}>
        <div>
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {member.email || member.uid}
        </p>
        </div>
      </SkeletonReveal>
      <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
        <ShieldCheck className="size-3.5" />
        <SkeletonReveal skeleton={<Skeleton className="h-3 w-14" />}><span>{member.roles.length +
            member.managedIssueCategoryIds.length +
            member.managedFacilityCategoryIds.length}{" "}{translate('ui.access.scopeCount')}</span></SkeletonReveal>
      </span>
      {action}
    </div>
  );
}
