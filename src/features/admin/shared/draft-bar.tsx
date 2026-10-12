"use client";

import * as React from "react";
import type { Draft } from "@/hooks/use-draft";
import type { DraftChange } from "@/lib/draft-diff";
import { SaveBar } from "@/ui/save-bar";
import { ReviewDialog } from "./review-dialog";

/**
 * The save bar and review dialog every draft-backed screen ends with. Saving
 * goes through the review whenever the draft estimated an impact that has to
 * be confirmed first.
 */
export function DraftBar<T>({ changes, describeChange, describeImpact, draft, formatChangeValue, reload }: {
  changes: DraftChange[];
  describeChange: (key: string) => React.ReactNode;
  describeImpact?: (key: string) => React.ReactNode;
  draft: Draft<T>;
  formatChangeValue?: (change: DraftChange, value: unknown) => React.ReactNode;
  /** Reads the server's copy again; the draft is discarded first. */
  reload: () => unknown;
}) {
  const [reviewing, setReviewing] = React.useState(false);
  return (
    <>
      <SaveBar
        changeCount={changes.length}
        disabled={!draft.valid}
        error={draft.error}
        onDiscard={draft.reset}
        onReload={() => { draft.reset(); void reload(); }}
        onReview={() => setReviewing(true)}
        onSave={() => void draft.submit()}
        status={draft.status}
      />
      <ReviewDialog
        changes={changes}
        describeChange={describeChange}
        describeImpact={describeImpact}
        formatChangeValue={formatChangeValue}
        impact={draft.impact}
        onCancel={() => { setReviewing(false); draft.cancel(); }}
        onConfirm={() => { setReviewing(false); void (draft.impact ? draft.confirm() : draft.submit()); }}
        open={reviewing || draft.impact !== null}
      />
    </>
  );
}
