"use client";

import { Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";

import { useI18n } from "@/i18n";
import { useAccessManagement, type AccessScope, type AccessUser } from "@/hooks/use-access-management";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListCustomRow, ListMutationRow, ListRow, ListSection, RowAction } from "@/components/ui/list";
import { ListPicker } from "@/components/ui/list-controls";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";
import { SkeletonRows } from "@/components/ui/skeleton-rows";

export function AccessManagement() {
  const { t } = useI18n();
  const state = useAccessManagement();
  useUnsavedChanges(state.draft.changes.length, state.draft.reset);

  return (
    <div className="space-y-6">
      <ListSection header={t("ui.access.scopeStep")}>
        <ListCustomRow>
          <LiquidTabs
            ariaLabel={t("ui.access.scopeType")}
            onValueChange={(value) => state.setKind(value as AccessScope["kind"])}
            options={[
              { label: t("ui.access.issueCategory"), value: "issue" },
              { label: t("ui.access.facilityCategory"), value: "facility" },
              { label: t("ui.access.announcementManagement"), value: "announcement" },
            ]}
            value={state.kind}
          />
        </ListCustomRow>
        {state.kind === "announcement" ? null : (
          <ListPicker
            label={t("ui.access.selectCategory")}
            onChange={state.setCategoryId}
            options={state.options.map((option) => ({
              label: option.label,
              value: option.id,
            }))}
            placeholder={t("ui.access.selectCategory")}
            value={state.categoryId}
          />
        )}
      </ListSection>

      {state.error ? <ErrorState error={state.error} onRetry={() => void state.load()} /> : null}

      {state.scope ? (
        <>
          <ListSection header={t("ui.access.currentStep")}>
            {state.loading && state.members.length === 0 ? (
              <SkeletonRows rows={2} />
            ) : state.members.length === 0 ? (
              <ListRow label={t("ui.access.noneTitle")} />
            ) : (
              state.members.map((member) => (
                <ListMutationRow
                  action={
                    <RowAction
                      icon={Trash2}
                      label={t("ui.access.revoke")}
                      onClick={() => state.revoke(member.uid)}
                      tone="destructive"
                    />
                  }
                  detail={member.email ?? member.uid}
                  key={member.uid}
                  label={<MemberName user={member} />}
                />
              ))
            )}
          </ListSection>

          <ListSection header={t("ui.access.searchStep")}>
            <ListCustomRow>
              <form
                className="flex w-full gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void state.search();
                }}
              >
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    onChange={(event) => state.setQuery(event.target.value)}
                    placeholder={t("ui.access.searchPlaceholder")}
                    value={state.query}
                  />
                </div>
                <Button disabled={state.searching} type="submit" variant="secondary">
                  {state.searching ? <LoadingSpinner /> : t("ui.common.search")}
                </Button>
              </form>
            </ListCustomRow>
            {state.candidate ? (
              state.hasScope(state.candidate.uid) ? (
                <ListRow
                  detail={state.candidate.email ?? state.candidate.uid}
                  icon={ShieldCheck}
                  label={<MemberName user={state.candidate} />}
                  value={t("ui.access.granted")}
                />
              ) : (
                <ListMutationRow
                  action={
                    <RowAction
                      icon={UserPlus}
                      label={t("ui.access.grant")}
                      onClick={() => state.candidate && state.grant(state.candidate.uid)}
                      tone="brand"
                    />
                  }
                  detail={state.candidate.email ?? state.candidate.uid}
                  label={<MemberName user={state.candidate} />}
                />
              )
            ) : null}
          </ListSection>
        </>
      ) : null}

      <SaveBar
        changeCount={state.draft.changes.length}
        onDiscard={state.draft.reset}
        onSave={() => void state.draft.submit()}
        status={state.draft.status}
      />
    </div>
  );
}

function MemberName({ user }: { user: AccessUser }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarImage src={user.photoUrl ?? undefined} />
        <AvatarFallback>{user.name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      {user.name}
    </span>
  );
}
