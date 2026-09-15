import type { ReactNode } from "react";

/** The feed, and whatever is shown over it. */
export default function IssueFeedLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
