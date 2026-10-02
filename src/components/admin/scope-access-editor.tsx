"use client";

import * as React from "react";
import { Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useI18n } from "@/i18n";
import { useScopeAccess, type AccessScope, type AccessUser } from "@/hooks/use-scope-access";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { ApplyReviewDialog } from "@/components/admin/apply-review-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListCustomRow, ListMutationRow, ListRow, ListSection, RowAction } from "@/components/ui/list";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";
import { SkeletonRows } from "@/components/ui/skeleton-rows";

export function ScopeAccessEditor({ scope, selector }: { scope: AccessScope | null; selector: React.ReactNode }) {
  const { t } = useI18n();
  const state = useScopeAccess(scope);
  const [reviewing, setReviewing] = React.useState(false);
  const saving = state.draft.status === "saving";
  useUnsavedChanges(state.changes.length, state.draft.reset);
  const nameOf = (uid: string) => {
    const user = state.known.find((member) => member.uid === uid);
    return user ? `${user.name}${user.email ? ` · ${user.email}` : ""}` : uid;
  };
  return <div className="space-y-6">
    <fieldset disabled={saving}>{selector}</fieldset>
    {state.error ? <ErrorState error={state.error} onRetry={() => void state.load()} /> : null}
    {scope ? <fieldset className="space-y-6" disabled={saving}>
      <ListSection header={t("ui.access.currentStep")}>
        {!state.draft.value ? state.error ? null : <SkeletonRows rows={2} /> : state.members.length === 0 ? (
          <ListRow label={t("ui.access.noneTitle")} />
        ) : state.members.map((member) => <ListMutationRow
          action={<RowAction icon={Trash2} label={t("ui.access.revokeMember", { name: member.email ?? member.uid })}
            onClick={() => state.revoke(member.uid)} tone="destructive" />}
          detail={member.email ?? member.uid} key={member.uid} label={<MemberName user={member} />}
        />)}
      </ListSection>
      <ListSection header={t("ui.access.searchStep")}>
        <ListCustomRow>
          <form className="flex w-full gap-2" onSubmit={(event) => { event.preventDefault(); void state.search(); }}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label={t("ui.access.searchPlaceholder")} className="pl-9" onChange={(event) => state.setQuery(event.target.value)}
                placeholder={t("ui.access.searchPlaceholder")} value={state.query} />
            </div>
            <Button disabled={state.searching || !state.query.trim() || !state.draft.value} type="submit" variant="secondary">
              {state.searching ? <LoadingSpinner /> : t("ui.common.search")}
            </Button>
          </form>
        </ListCustomRow>
        {state.searchError ? <ListCustomRow><p className="text-sm text-destructive" role="alert">{state.searchError}</p></ListCustomRow> : null}
        {state.searched && !state.candidate ? <ListRow label={t("access.userNotFoundHelp")} /> : null}
        {state.candidate ? state.candidate.roles.includes("platform-admin") || state.hasScope(state.candidate.uid) ? (
          <ListRow detail={state.candidate.email ?? state.candidate.uid} icon={ShieldCheck}
            label={<MemberName user={state.candidate} />} value={t(state.candidate.roles.includes("platform-admin") ? "admin.scopePlatformAdmin" : "ui.access.granted")} />
        ) : <ListMutationRow
          action={<RowAction icon={UserPlus} label={t("ui.access.grantMember", { name: state.candidate.email ?? state.candidate.uid })}
            onClick={() => state.candidate && state.grant(state.candidate.uid)} tone="brand" />}
          detail={state.candidate.email ?? state.candidate.uid} label={<MemberName user={state.candidate} />}
        /> : null}
      </ListSection>
    </fieldset> : null}
    <SaveBar changeCount={state.changes.length} error={state.draft.error} onDiscard={state.draft.reset}
      onReload={() => { state.draft.reset(); void state.load(); }} onReview={() => setReviewing(true)}
      onSave={() => void state.draft.submit()} status={state.draft.status} />
    <ApplyReviewDialog changes={state.changes} describeChange={nameOf}
      formatChangeValue={(_change, value) => t(value ? "admin.scopeAssigned" : "admin.scopeUnassigned")}
      onCancel={() => setReviewing(false)} onConfirm={() => { setReviewing(false); void state.draft.submit(); }} open={reviewing} />
  </div>;
}

function MemberName({ user }: { user: AccessUser }) {
  return <span className="flex items-center gap-2">
    <Avatar className="size-6"><AvatarImage src={user.photoUrl ?? undefined} /><AvatarFallback>{user.name.slice(0, 1)}</AvatarFallback></Avatar>
    {user.name}
  </span>;
}
