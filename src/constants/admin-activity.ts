/**
 * What the administration overview reports on: the periods it can be read over,
 * and the kinds of thing it counts within one.
 *
 * The overview names these, the sheet a figure opens names them again, and the
 * full activity record offers the same periods, so the table lives here rather
 * than three times over.
 */
export type AdminOverviewWindow = "24h" | "7d" | "30d";

export interface AdminOverviewWindowOption {
  labelKey: string;
  value: AdminOverviewWindow;
}

export const ADMIN_OVERVIEW_WINDOWS: readonly AdminOverviewWindowOption[] = [
  { labelKey: "ui.adminConsole.window24h", value: "24h" },
  { labelKey: "ui.adminConsole.window7d", value: "7d" },
  { labelKey: "ui.adminConsole.window30d", value: "30d" },
];

export function adminOverviewWindowLabelKey(value: AdminOverviewWindow): string {
  return ADMIN_OVERVIEW_WINDOWS.find((option) => option.value === value)?.labelKey ?? "";
}

export type AdminPeriodKind = "registration" | "issue" | "comment" | "facility";

export interface AdminPeriodFigure {
  /** The field of the overview reading that holds this figure. */
  countKey: "newUsers" | "newIssues" | "newComments" | "newFacilities";
  kind: AdminPeriodKind;
  labelKey: string;
}

/** The four figures a period is read as, each of which opens its own screen. */
export const ADMIN_PERIOD_FIGURES: readonly AdminPeriodFigure[] = [
  { countKey: "newUsers", kind: "registration", labelKey: "ui.adminConsole.newRegistrations" },
  { countKey: "newIssues", kind: "issue", labelKey: "ui.adminConsole.newIssues" },
  { countKey: "newComments", kind: "comment", labelKey: "ui.adminConsole.newComments" },
  { countKey: "newFacilities", kind: "facility", labelKey: "ui.adminConsole.newFacilities" },
];
