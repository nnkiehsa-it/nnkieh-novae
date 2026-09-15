import type { ReactNode } from "react";

/**
 * The list, and whatever is shown over it.
 *
 * A record opened from the list arrives in the slot rather than in place of the
 * list, which is what lets the list keep its scroll and its loaded pages while
 * the record is read.
 */
export default function AnnouncementsLayout({
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
