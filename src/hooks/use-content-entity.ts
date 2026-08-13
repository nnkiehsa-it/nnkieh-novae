"use client";

import * as React from "react";
import {
  getContentEntity,
  getContentEntityDomainVersion,
  subscribeContentEntity,
  subscribeContentEntityDomain,
  type ContentEntity,
  type ContentEntityDomain,
} from "@/lib/content-entity-store";

export function useContentEntity<T extends ContentEntity>(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
) {
  return React.useSyncExternalStore(
    React.useCallback(
      (listener) => subscribeContentEntity(scope, domain, id, listener),
      [domain, id, scope],
    ),
    React.useCallback(
      () => getContentEntity<T>(scope, domain, id),
      [domain, id, scope],
    ),
    () => undefined,
  );
}

export function useContentEntityDomainVersion(
  scope: string | undefined,
  domain: ContentEntityDomain,
) {
  return React.useSyncExternalStore(
    React.useCallback(
      (listener) => subscribeContentEntityDomain(scope, domain, listener),
      [domain, scope],
    ),
    React.useCallback(
      () => getContentEntityDomainVersion(scope, domain),
      [domain, scope],
    ),
    () => 0,
  );
}
