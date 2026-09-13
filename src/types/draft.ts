/** Where an editing session stands between loading a value and storing it. */
export type DraftStatus = "clean" | "dirty" | "saving" | "saved" | "failed";
