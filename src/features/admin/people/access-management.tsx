import * as React from "react";
import { getUnsavedChanges } from "@/hooks/unsaved-changes-store";
import { useAccessTarget } from "@/hooks/use-access-target";
import { useCategories } from "@/hooks/use-categories";
import { accessScopeKey, type AccessScope } from "@/hooks/use-scope-access";
import { useSession } from "@/hooks/use-session";
import { useI18n } from "@/i18n";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { ListGroup } from "@/ui/list";
import { PickerRow } from "@/ui/list-controls";
import { SectionTitle } from "@/ui/panel";
import { Segmented } from "@/ui/segmented";
import { ScopeAccessEditor } from "./scope-access-editor";

interface Target {
  facilityId: string;
  issueId: string;
  kind: AccessScope["kind"];
}

const SCOPE_GROUP = "scope-members";

/** Who manages what: pick an area, then edit its managers. The choice lives in the URL; the editor remounts for each distinct scope. */
export function AccessManagement() {
  const { t } = useI18n();
  const { activeFacilityCategories, activeIssueCategories } = useCategories();
  const { user } = useSession();
  const [target, remember] = useAccessTarget();
  const [pending, setPending] = React.useState<Target | null>(null);
  const options = React.useMemo(
    () => (target.kind === "issue" ? activeIssueCategories : target.kind === "facility" ? activeFacilityCategories : []),
    [activeFacilityCategories, activeIssueCategories, target.kind],
  );
  const categoryField = target.kind === "issue" ? "issueId" : "facilityId";
  const requestedId = target.kind === "issue" ? target.issueId : target.facilityId;
  const categoryId = requestedId || (options.length === 1 ? options[0]!.id : "");

  React.useEffect(() => {
    if (target.kind !== "announcement" && !requestedId && options.length === 1) {
      remember({ ...target, [categoryField]: options[0]!.id }, true);
    }
  }, [categoryField, options, remember, requestedId, target]);

  const scope = React.useMemo<AccessScope | null>(
    () => (target.kind === "announcement" ? { kind: target.kind } : categoryId ? { kind: target.kind, categoryId } : null),
    [categoryId, target.kind],
  );
  const change = (next: Target) => {
    if (getUnsavedChanges(SCOPE_GROUP).count > 0) setPending(next);
    else remember(next);
  };

  const selector = (
    <section className="grid gap-3">
      <SectionTitle>{t("ui.access.scopeStep")}</SectionTitle>
      <Segmented
        className="justify-self-start"
        label={t("ui.access.scopeType")}
        onChange={(kind) => change({ ...target, kind })}
        options={[
          { label: t("ui.access.issueCategory"), value: "issue" },
          { label: t("ui.access.facilityCategory"), value: "facility" },
          { label: t("ui.access.announcementManagement"), value: "announcement" },
        ]}
        value={target.kind}
      />
      {target.kind !== "announcement" ? (
        <ListGroup label={t("ui.access.selectCategory")}>
          <PickerRow
            label={t("ui.access.selectCategory")}
            onChange={(id) => change({ ...target, [categoryField]: id })}
            options={options.map((option) => ({ label: option.label, value: option.id }))}
            placeholder={t("ui.access.selectCategory")}
            value={categoryId}
          />
        </ListGroup>
      ) : null}
    </section>
  );

  return (
    <>
      <ScopeAccessEditor key={`${user?.uid}:${accessScopeKey(scope)}`} scope={scope} selector={selector} />
      <ConfirmDialog
        cancelLabel={t("admin.leaveStay")}
        confirmLabel={t("admin.leaveDiscard")}
        description={t("admin.leaveMessage", { count: getUnsavedChanges(SCOPE_GROUP).count })}
        onConfirm={() => {
          getUnsavedChanges(SCOPE_GROUP).discard();
          if (pending) remember(pending);
          setPending(null);
        }}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        open={pending !== null}
        title={t("admin.leaveTitle")}
        tone="danger"
      />
    </>
  );
}
