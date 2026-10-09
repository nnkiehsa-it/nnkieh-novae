"use client";

import {
  isUserRestricted,
  responsibilityLabel,
  UserDetailsSheet,
} from "@/components/admin/user-details-sheet";
import { PersonIdentity } from "@/components/content-author";
import { RecordList } from "@/components/ui/record-list";
import { useAdminUsers } from "@/hooks/use-admin-console";
import { useI18n, type TranslationParams } from "@/i18n";
import { formatRelativeTime } from "@/lib/format";
import type { AdminUser } from "@/hooks/use-admin-console";
import { ListNavRow } from "@/components/ui/list";
import { Badge } from "@/components/ui/badge";

type Translator = (key: string, params?: TranslationParams) => string;

/**
 * One person, as small as a person can honestly be written.
 *
 * A member used to be a row of five columns, which meant five stacked labelled
 * fields on anything narrower than a desktop and a great deal of empty width on
 * a desktop. What an administrator scans for is a name, whether the account is
 * in an unusual state, and how recently it was used; the rest of the record
 * opens in the sheet. Two of these fit across a card, so the list is a third of
 * the height it was.
 */
function PersonRow({
  disabled,
  onSelect,
  selected,
  t,
  user,
}: {
  disabled: boolean;
  onSelect: (user: AdminUser) => void;
  selected: boolean;
  t: Translator;
  user: AdminUser;
}) {
  const administrator = user.roles.includes("platform-admin");
  const restricted = !administrator && isUserRestricted(user);
  const responsibility = responsibilityLabel(user, t);
  const status = administrator
    ? t("ui.adminConsole.platformAdmin")
    : restricted
      ? t("ui.adminConsole.restricted")
      : t("ui.adminConsole.normal");
  const activity = user.lastSeenAt
    ? formatRelativeTime(user.lastSeenAt)
    : t("ui.adminConsole.neverSeen");
  const detail = [responsibility === "—" ? "" : responsibility, activity].filter(Boolean).join(" · ");

  return (
    <ListNavRow
      selected={selected}
      disabled={disabled}
      onClick={() => onSelect(user)}
      label={<PersonIdentity name={user.name} photoUrl={user.photoUrl} />}
      value={<Badge color={restricted ? "red" : administrator ? "blue" : "gray"}>{status}</Badge>}
      detail={<>{user.email ?? user.uid}<br />{detail}</>}
    />
  );
}

export function UserManagement() {
  const { t } = useI18n();
  const state = useAdminUsers();

  return (
    <>
      <RecordList
        disabled={Boolean(state.busy)}
        count={state.users.length}
        emptyLabel={t("ui.adminConsole.noUsers")}
        error={state.error}
        hasMore={state.hasMore}
        loading={state.loading}
        onPageChange={(page) => void state.changePage(page)}
        onQueryChange={state.setQuery}
        onSearch={() => void state.load(state.query)}
        onReset={() => void state.resetSearch()}
        page={state.page}
        query={state.query}
        searchPlaceholder={t("ui.adminConsole.userSearchPlaceholder")}
      >
          {state.users.map((user) => (
            <PersonRow
              disabled={Boolean(state.busy)}
              key={user.uid}
              onSelect={state.setSelected}
              selected={state.selected?.uid === user.uid}
              t={t}
              user={user}
            />
          ))}
      </RecordList>
      <UserDetailsSheet
        busy={Boolean(state.busy)}
        error={state.mutationError}
        onReload={state.refresh}
        onClose={() => {
          state.setSelected(null);
        }}
        onRestrictionChange={(input) =>
          state.selected ? state.updateRestriction(state.selected, input) : Promise.resolve(null)
        }
        user={state.selected}
      />
    </>
  );
}
