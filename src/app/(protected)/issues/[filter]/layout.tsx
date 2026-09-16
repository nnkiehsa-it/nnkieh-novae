import type { ReactNode } from "react";

/** The feed, and whatever is shown over it. */
export default function IssueFeedLayout({
  children,
  sheet,
}: {
  children: ReactNode;
  sheet: ReactNode;
}) {
  return (
    <>
      {children}
      {sheet}
    </>
  );
}
