"use client";

import type * as React from "react";
import { FeatureRouteGuard } from "./feature-guard";
import { RecordPage, RecordSheet } from "./record-frame";

/**
 * The frame a record or composer route renders in: a sheet when the route was
 * opened over a list, a page when it was reached by its own URL.
 */
export function RecordRoute({ children, feature, listHref, sheet = false, title }: {
  children: React.ReactNode;
  /** The feature that must be switched on for this route to exist. */
  feature?: "facilities" | "issues";
  listHref: string;
  sheet?: boolean;
  title: string;
}) {
  const framed = sheet
    ? <RecordSheet listHref={listHref} title={title}>{children}</RecordSheet>
    : <RecordPage listHref={listHref}>{children}</RecordPage>;
  return feature ? <FeatureRouteGuard feature={feature}>{framed}</FeatureRouteGuard> : framed;
}
