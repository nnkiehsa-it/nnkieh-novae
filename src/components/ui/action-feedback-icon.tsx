import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ActionFeedbackIcon({
  className,
  size = "lg",
  state,
}: {
  className?: string;
  size?: "lg" | "md" | "sm";
  state: "loading" | "success";
}) {
  return (
    <span
      aria-hidden
      className={cn("t-spinner-check", className)}
      data-size={size}
      data-state={state === "success" ? "complete" : "loading"}
    >
      <LoaderCircle className="t-spinner t-spinner-check-loader" />
      <svg className="t-spinner-check-success" viewBox="0 0 24 24">
        <path d="m6.5 12.5 3.25 3.25 7.75-8" />
      </svg>
    </span>
  );
}
