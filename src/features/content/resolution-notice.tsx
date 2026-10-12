import { CheckCircle, WarningCircle } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

/** How a case was closed: the outcome, in the words of whoever closed it. */
export function ResolutionNotice({ content, fallbackAlt, title, tone }: {
  content: string;
  fallbackAlt: string;
  title: string;
  tone: "error" | "success";
}) {
  const Icon = tone === "error" ? WarningCircle : CheckCircle;
  return (
    <section
      aria-label={title}
      className={cn("grid gap-3 rounded-panel border p-5", tone === "error" ? "border-danger/25 bg-danger/8" : "border-positive/25 bg-positive/8")}
    >
      <p className={cn("flex items-center gap-2 text-[0.9375rem] font-semibold", tone === "error" ? "text-danger" : "text-positive")}>
        <Icon className="size-5" weight="fill" />
        {title}
      </p>
      <Markdown content={content} fallbackAlt={fallbackAlt} />
    </section>
  );
}
