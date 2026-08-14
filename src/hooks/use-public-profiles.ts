"use client";

import * as React from "react";
import {
  fetchUserPublicProfiles,
  getCachedUserPublicProfiles,
} from "@/services/users-read";
import type { DiscussionCommentRecord, UserPublicProfile } from "@/types";

export function usePublicProfiles(authorUids: Array<string | null | undefined>) {
  const profileKey = React.useMemo(
    () =>
      [...new Set(authorUids.filter((uid): uid is string => Boolean(uid)))]
        .sort()
        .join("|"),
    [authorUids],
  );
  const [profiles, setProfiles] = React.useState<Record<string, UserPublicProfile>>(
    () => getCachedUserPublicProfiles(profileKey ? profileKey.split("|") : []),
  );

  React.useEffect(() => {
    const uids = profileKey ? profileKey.split("|") : [];
    if (uids.length === 0) return;
    const cached = getCachedUserPublicProfiles(uids);
    if (Object.keys(cached).length > 0)
      setProfiles((current) => ({ ...current, ...cached }));
    const missingUids = uids.filter((uid) => !cached[uid]);
    if (missingUids.length === 0) return;
    let active = true;
    void fetchUserPublicProfiles(missingUids)
      .then((result) => {
        if (active) setProfiles((current) => ({ ...current, ...result }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [profileKey]);

  return profiles;
}

export function useDiscussionProfiles(comments: DiscussionCommentRecord[]) {
  const authorUids = React.useMemo(
    () =>
      comments.flatMap((comment) => [
        comment.author_uid,
        ...comment.replies.map((reply) => reply.author_uid),
      ]),
    [comments],
  );
  return usePublicProfiles(authorUids);
}
