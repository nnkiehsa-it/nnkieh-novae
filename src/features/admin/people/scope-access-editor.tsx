import type * as React from "react";
import { ShieldCheck, Trash, UserPlus } from "@phosphor-icons/react/ssr";
import { useScopeAccess, type AccessScope } from "@/hooks/use-scope-access";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useI18n } from "@/i18n";
import { ListGroup, ListRow } from "@/ui/list";
import { LoadingList } from "@/ui/page";
import { SectionTitle } from "@/ui/panel";
import { DraftBar } from "../shared/draft-bar";
import { InlineAlert, LoadError } from "../shared/feedback";
import { IconAction } from "../shared/icon-actions";
import { PersonRow } from "../shared/rows";
import { SearchForm } from "../shared/search-form";

/** The managers of one scope: who holds it now, and a lookup to add someone. Changes stay in a draft until saved. */
export function ScopeAccessEditor({ scope, selector }: { scope: AccessScope | null; selector: React.ReactNode }) {
  const { t } = useI18n();
  const state = useScopeAccess(scope);
  const saving = state.draft.status === "saving";
  useUnsavedChanges(state.changes.length, state.draft.reset, "scope-members", saving);

  const nameOf = (uid: string) => {
    const member = state.known.find((user) => user.uid === uid);
    return member ? `${member.name}${member.email ? ` · ${member.email}` : ""}` : uid;
  };
  const candidate = state.candidate;
  const candidateManages = candidate ? candidate.roles.includes("platform-admin") || state.hasScope(candidate.uid) : false;

  return (
    <div className="grid gap-6">
      <fieldset className="min-w-0" disabled={saving}>{selector}</fieldset>
      {state.error ? <LoadError message={state.error} onRetry={() => void state.load()} /> : null}
      {scope ? (
        <fieldset className="grid min-w-0 gap-6" disabled={saving}>
          {state.draft.value ? (
            <ListGroup title={t("ui.access.currentStep")}>
              {state.members.length === 0 ? (
                <ListRow label={t("ui.access.noneTitle")} />
              ) : (
                state.members.map((member) => (
                  <PersonRow
                    detail={member.email ?? member.uid}
                    key={member.uid}
                    name={member.name}
                    photoUrl={member.photoUrl}
                    trailing={
                      <IconAction
                        icon={<Trash />}
                        label={t("ui.access.revokeMember", { name: member.email ?? member.uid })}
                        onClick={() => state.revoke(member.uid)}
                        tone="danger"
                      />
                    }
                  />
                ))
              )}
            </ListGroup>
          ) : state.error ? null : (
            <LoadingList label={t("common.loading")} rows={2} />
          )}
          <section className="grid gap-3">
            <SectionTitle>{t("ui.access.searchStep")}</SectionTitle>
            <SearchForm
              label={t("ui.access.searchPlaceholder")}
              loading={state.searching}
              onQueryChange={state.setQuery}
              onSearch={() => void state.search()}
              query={state.query}
              submitDisabled={!state.query.trim() || !state.draft.value}
            />
            {state.searchError ? <InlineAlert>{state.searchError}</InlineAlert> : null}
            {state.searched && !candidate ? (
              <ListGroup label={t("ui.access.searchStep")}><ListRow label={t("access.userNotFoundHelp")} /></ListGroup>
            ) : null}
            {candidate ? (
              <ListGroup label={t("ui.access.searchStep")}>
                {candidateManages ? (
                  <PersonRow
                    detail={candidate.email ?? candidate.uid}
                    name={candidate.name}
                    photoUrl={candidate.photoUrl}
                    trailing={
                      <span className="flex items-center gap-2 text-sm text-ink-muted">
                        <ShieldCheck aria-hidden className="size-5" />
                        {t(candidate.roles.includes("platform-admin") ? "admin.scopePlatformAdmin" : "ui.access.granted")}
                      </span>
                    }
                  />
                ) : (
                  <PersonRow
                    detail={candidate.email ?? candidate.uid}
                    name={candidate.name}
                    photoUrl={candidate.photoUrl}
                    trailing={
                      <IconAction
                        icon={<UserPlus />}
                        label={t("ui.access.grantMember", { name: candidate.email ?? candidate.uid })}
                        onClick={() => state.grant(candidate.uid)}
                      />
                    }
                  />
                )}
              </ListGroup>
            ) : null}
          </section>
        </fieldset>
      ) : null}
      <DraftBar
        changes={state.changes}
        describeChange={nameOf}
        draft={state.draft}
        formatChangeValue={(_change, value) => t(value ? "admin.scopeAssigned" : "admin.scopeUnassigned")}
        reload={state.load}
      />
    </div>
  );
}
