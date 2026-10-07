"use client";

import * as React from "react";
import {
  fetchUserPublicProfiles,
  getCachedUserPublicProfiles,
} from "@/services/users-read";
import type { DiscussionCommentRecord } from "@/types";
import { useSession } from "@/hooks/use-session";

export function usePublicProfiles(authorUids: Array<string | null | undefined>) {
  const { user } = useSession();
  const profileKey = React.useMemo(
    () =>
      [...new Set(authorUids.filter((uid): uid is string => Boolean(uid)))]
        .sort()
        .join("|"),
    [authorUids],
  );
  const [reading, setReading] = React.useState(() => ({
    uid: user?.uid, profiles: getCachedUserPublicProfiles(profileKey ? profileKey.split("|") : []),
  }));
  const profiles = reading.uid === user?.uid ? reading.profiles : {};

  React.useEffect(() => {
    const uids = profileKey ? profileKey.split("|") : [];
    if (uids.length === 0) return;
    const cached = getCachedUserPublicProfiles(uids);
    if (Object.keys(cached).length > 0)
      setReading((current) => ({ uid: user?.uid, profiles: { ...(current.uid === user?.uid ? current.profiles : {}), ...cached } }));
    const missingUids = uids.filter((uid) => !cached[uid]);
    if (missingUids.length === 0) return;
    let active = true;
    void fetchUserPublicProfiles(missingUids)
      .then((result) => {
        if (active) setReading((current) => ({ uid: user?.uid, profiles: { ...(current.uid === user?.uid ? current.profiles : {}), ...result } }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [profileKey, user?.uid]);

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
