import { useAdminView } from "@/hooks/use-admin-view";
import { useI18n } from "@/i18n";
import { SectionTabs } from "../shared/section-tabs";
import { VisitedPanel } from "../shared/visited-panel";
import { AccessManagement } from "./access-management";
import { AccountAccessRules } from "./account-access-rules";
import { UserManagement } from "./user-management";

const VIEWS = ["accounts", "scopes", "restrictions"] as const;

/**
 * Accounts and category responsibility are two readings of one relationship,
 * so they share a screen: by person, by the area being managed, or by the
 * rules that restrict access. Visited views stay mounted so their drafts survive.
 */
export function PeopleConsole() {
  const { t } = useI18n();
  const [view, setView] = useAdminView(VIEWS);
  return (
    <div className="grid gap-6">
      <SectionTabs
        label={t("admin.peopleTitle")}
        onChange={setView}
        sections={[
          { detail: t("admin.summary.accounts"), label: t("admin.peopleByAccount"), value: "accounts" },
          { detail: t("admin.summary.scopes"), label: t("admin.peopleByScope"), value: "scopes" },
          { detail: t("admin.summary.restrictions"), label: t("ui.accountAccess.rulesTab"), value: "restrictions" },
        ]}
        value={view}
      />
      <VisitedPanel active={view === "accounts"}><UserManagement /></VisitedPanel>
      <VisitedPanel active={view === "scopes"}><AccessManagement /></VisitedPanel>
      <VisitedPanel active={view === "restrictions"}><AccountAccessRules /></VisitedPanel>
    </div>
  );
}
