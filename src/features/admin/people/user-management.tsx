import { useAdminUsers, type AdminUser } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatRelativeTime } from "@/lib/format";
import { Chip } from "@/ui/chip";
import { RecordBrowser } from "../shared/record-browser";
import { PersonRow } from "../shared/rows";
import { UserDetailsSheet } from "./user-details-sheet";
import { responsibilityLabel, standingOf, type Standing } from "./user-summary";

const STANDINGS: Record<Standing, { labelKey: string; tone: "danger" | "info" | "neutral" }> = {
  admin: { labelKey: "ui.adminConsole.platformAdmin", tone: "info" },
  normal: { labelKey: "ui.adminConsole.normal", tone: "neutral" },
  restricted: { labelKey: "ui.adminConsole.restricted", tone: "danger" },
};

/**
 * One person, as small as a person can honestly be written: a name, whether
 * the account is in an unusual state, and how recently it was used. The rest
 * of the record opens in the sheet.
 */
function UserRow({ disabled, onSelect, user }: { disabled: boolean; onSelect: (user: AdminUser) => void; user: AdminUser }) {
  const { t } = useI18n();
  const standing = STANDINGS[standingOf(user)];
  const activity = user.lastSeenAt ? formatRelativeTime(user.lastSeenAt) : t("ui.adminConsole.neverSeen");
  return (
    <PersonRow
      detail={[user.email ?? user.uid, responsibilityLabel(user, t), activity].filter(Boolean).join(" · ")}
      disabled={disabled}
      name={user.name}
      onClick={() => onSelect(user)}
      photoUrl={user.photoUrl}
      value={<Chip tone={standing.tone}>{t(standing.labelKey)}</Chip>}
    />
  );
}

export function UserManagement() {
  const { t } = useI18n();
  const state = useAdminUsers();
  const busy = Boolean(state.busy);

  return (
    <>
      <RecordBrowser
        count={state.users.length}
        disabled={busy}
        emptyLabel={t("ui.adminConsole.noUsers")}
        error={state.error}
        hasMore={state.hasMore}
        loading={state.loading}
        onPageChange={(page) => void state.changePage(page)}
        onQueryChange={state.setQuery}
        onReset={() => void state.resetSearch()}
        onSearch={() => void state.load(state.query)}
        page={state.page}
        query={state.query}
        searchLabel={t("ui.adminConsole.userSearchPlaceholder")}
      >
        {state.users.map((user) => (
          <UserRow disabled={busy} key={user.uid} onSelect={state.setSelected} user={user} />
        ))}
      </RecordBrowser>
      <UserDetailsSheet
        busy={busy}
        error={state.mutationError}
        onClose={() => state.setSelected(null)}
        onReload={state.refresh}
        onRestrictionChange={(input) => (state.selected ? state.updateRestriction(state.selected, input) : Promise.resolve(null))}
        user={state.selected}
      />
    </>
  );
}
