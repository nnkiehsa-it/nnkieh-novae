import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchUserPublicProfiles,
  getCachedUserPublicProfiles,
  PROFILE_MAX_AGE_MS,
} from "@/services/users-read";
import type { Comment, UserPublicProfile } from "@/types";

const NO_PROFILES: Record<string, UserPublicProfile> = {};

/** The public profiles of these accounts; one that cannot be read is simply absent. */
export function usePublicProfiles(authorUids: Array<string | null | undefined>) {
  const uids = React.useMemo(
    () => [...new Set(authorUids.filter((uid): uid is string => Boolean(uid)))].sort(),
    [authorUids],
  );
  const query = useQuery({
    enabled: uids.length > 0,
    queryKey: ["profiles", "set", uids.join("|")],
    queryFn: () => fetchUserPublicProfiles(uids),
    initialData: () => {
      const cached = getCachedUserPublicProfiles(uids);
      return Object.keys(cached).length === uids.length ? cached : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: PROFILE_MAX_AGE_MS,
  });
  return query.data ?? NO_PROFILES;
}

export function useDiscussionProfiles(comments: Comment[]) {
  const authorUids = React.useMemo(
    () =>
      comments.flatMap((comment) => [
        comment.authorUid,
        ...comment.replies.map((reply) => reply.authorUid),
      ]),
    [comments],
  );
  return usePublicProfiles(authorUids);
}
