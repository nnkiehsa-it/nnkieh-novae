"use client";

import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { AlertDialogAction } from "@/components/ui/alert-dialog";

export function PendingAlertDialogAction({
  children,
  onConfirm,
  state,
}: {
  children: React.ReactNode;
  onConfirm: () => void;
  state: "idle" | "loading" | "success";
}) {
  return (
    <AlertDialogAction
      disabled={state !== "idle"}
      onClick={(event) => {
        event.preventDefault();
        onConfirm();
      }}
    >
      {state !== "idle" ? (
        <ActionFeedbackIcon
          className="bg-transparent [&>svg]:size-5"
          size="md"
          state={state === "success" ? "success" : "loading"}
        />
      ) : null}
      {children}
    </AlertDialogAction>
  );
}
