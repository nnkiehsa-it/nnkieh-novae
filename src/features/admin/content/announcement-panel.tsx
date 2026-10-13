"use client";

import { useI18n } from "@/i18n";
import { ListGroup } from "@/ui/list";
import { SwitchRow } from "@/ui/list-controls";
import { ImagePolicyRows } from "./image-policy-rows";
import type { CategoryDraftValue, CategoryManagement } from "./category-state";

/** Announcements have no categories; they have comments and image limits. */
export function AnnouncementPanel({ state, value }: { state: CategoryManagement; value: CategoryDraftValue }) {
  const { t } = useI18n();
  return (
    <ListGroup footer={t("admin.imagePolicyHelp")} label={t("ui.nav.announcements")}>
      <SwitchRow
        checked={value.announcementCommentsEnabled}
        label={t("ui.admin.announcementComments")}
        onChange={(announcementCommentsEnabled) => state.draft.update({ announcementCommentsEnabled })}
      />
      <ImagePolicyRows
        onChange={(announcementMaxImages) => state.draft.update({ announcementMaxImages })}
        value={value.announcementMaxImages}
      />
      {value.announcementCommentsEnabled ? (
        <ImagePolicyRows
          comments
          onChange={(announcementCommentMaxImages) => state.draft.update({ announcementCommentMaxImages })}
          value={value.announcementCommentMaxImages}
        />
      ) : null}
    </ListGroup>
  );
}
