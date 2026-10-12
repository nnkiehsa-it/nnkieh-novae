import { redirect } from "next/navigation";
import { feedHref } from "@/lib/feed-href";

export default function Page() {
  redirect(feedHref("issues"));
}
