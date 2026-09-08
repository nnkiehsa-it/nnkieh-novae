import type { ReactNode } from "react";
import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DetailCardHeader({
  badges,
  metadata,
  separated = false,
  title,
}: {
  badges: ReactNode;
  metadata: ReactNode;
  separated?: boolean;
  title: ReactNode;
}) {
  return (
    <div className={cn("bg-background/60 px-5 py-5 sm:px-6", separated && "border-b")}>
      <div className="flex min-h-6 flex-wrap items-center gap-2">{badges}</div>
      <div className="mt-3 min-h-9 text-2xl font-semibold leading-9 tracking-[-0.035em] sm:text-[1.625rem]">{title}</div>
      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-2 text-[0.8125rem] text-muted-foreground">{metadata}</div>
    </div>
  );
}

export function DetailCardBody({ children }: { children: ReactNode }) {
  return <CardContent className="py-5 sm:px-6">{children}</CardContent>;
}
