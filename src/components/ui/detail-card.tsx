import type { ReactNode } from "react";
import { CardContent } from "@/components/ui/card";

export function DetailCardHeader({
  badges,
  metadata,
  title,
}: {
  badges: ReactNode;
  metadata: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="bg-background/60 px-5 py-5 sm:px-6">
      <div className="flex min-h-6 flex-wrap items-center gap-2">{badges}</div>
      <div className="mt-3 min-h-9 text-2xl font-semibold leading-9 tracking-[-0.035em] sm:text-[1.625rem]">{title}</div>
      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-2 text-[0.8125rem] text-muted-foreground">{metadata}</div>
    </div>
  );
}

export function DetailCardBody({ children }: { children: ReactNode }) {
  return <CardContent className="py-5 sm:px-6">{children}</CardContent>;
}
