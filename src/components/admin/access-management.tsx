"use client";

import * as React from "react";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";
import { useAccessTarget } from "@/hooks/use-access-target";
import { getUnsavedChanges } from "@/hooks/unsaved-changes-store";
import { ScopeAccessEditor } from "@/components/admin/scope-access-editor";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ListCustomRow, ListSection } from "@/components/ui/list";
import { ListPicker } from "@/components/ui/choice-select";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { accessScopeKey, type AccessScope } from "@/hooks/use-scope-access";

interface Target {
  kind: AccessScope["kind"];
  issueId: string;
  facilityId: string;
}

/** The target survives navigation; the editor is remounted for each distinct scope. */
export function AccessManagement() {
  const { t } = useI18n();
  const { activeFacilityCategories, activeIssueCategories } = useCategories();
  const { user } = useSession();
  const [target, remember] = useAccessTarget();
  const [pending, setPending] = React.useState<Target | null>(null);
  const options = React.useMemo(() => target.kind === "issue" ? activeIssueCategories : target.kind === "facility" ? activeFacilityCategories : [],
    [activeFacilityCategories, activeIssueCategories, target.kind]);
  const requestedId = target.kind === "issue" ? target.issueId : target.facilityId;
  const categoryId = requestedId || (options.length === 1 ? options[0]!.id : "");
  React.useEffect(() => {
    if (target.kind !== "announcement" && !requestedId && options.length === 1) {
      remember({ ...target, [target.kind === "issue" ? "issueId" : "facilityId"]: options[0]!.id }, true);
    }
  }, [options, remember, requestedId, target]);
  const scope = React.useMemo<AccessScope | null>(() => target.kind === "announcement" ? { kind: target.kind }
    : categoryId ? { kind: target.kind, categoryId } : null, [categoryId, target.kind]);
  const change = (next: Target) => {
    if (getUnsavedChanges().count > 0) setPending(next);
    else remember(next);
  };
  const selector = <ListSection header={t("ui.access.scopeStep")}>
    <ListCustomRow>
      <LiquidTabs ariaLabel={t("ui.access.scopeType")} onValueChange={(kind) => change({ ...target, kind: kind as AccessScope["kind"] })}
        options={[
          { label: t("ui.access.issueCategory"), value: "issue" },
          { label: t("ui.access.facilityCategory"), value: "facility" },
          { label: t("ui.access.announcementManagement"), value: "announcement" },
        ]} value={target.kind} />
    </ListCustomRow>
    {target.kind !== "announcement" ? <ListPicker label={t("ui.access.selectCategory")}
      onChange={(id) => change({ ...target, [target.kind === "issue" ? "issueId" : "facilityId"]: id })}
      options={options.map((option) => ({ label: option.label, value: option.id }))}
      placeholder={t("ui.access.selectCategory")} value={categoryId} /> : null}
  </ListSection>;
  return <>
    <ScopeAccessEditor key={`${user?.uid}:${accessScopeKey(scope)}`} scope={scope} selector={selector} />
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t("admin.leaveTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("admin.leaveMessage", { count: getUnsavedChanges().count })}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>{t("admin.leaveStay")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            getUnsavedChanges().discard();
            if (pending) remember(pending);
            setPending(null);
          }}>{t("admin.leaveDiscard")}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
