import { notFound } from "next/navigation";
import { Gallery } from "./gallery";

/** Development-only catalogue of the src/ui primitives. */
export default function UiPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Gallery />;
}
