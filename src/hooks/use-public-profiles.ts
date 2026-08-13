"use client";

import * as React from "react";
import { fetchUserPublicProfiles } from "@/services/users-read";
import type { DiscussionCommentRecord, UserPublicProfile } from "@/types";

export function usePublicProfiles(authorUids: Array<string | null | undefined>) {
  const [profiles, setProfiles] = React.useState<Record<string, UserPublicProfile>>({});
  const profileKey = React.useMemo(
    () =>
      [...new Set(authorUids.filter((uid): uid is string => Boolean(uid)))]
        .sort()
        .join("|"),
    [authorUids],
  );

  React.useEffect(() => {
    const uids = profileKey ? profileKey.split("|") : [];
    if (uids.length === 0) {
      setProfiles({});
      return;
    }
    let active = true;
    void fetchUserPublicProfiles(uids)
      .then((result) => {
        if (active) setProfiles(result);
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
