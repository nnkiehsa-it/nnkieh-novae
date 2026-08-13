import { redirect } from "next/navigation";
export default function AccessRedirect() {
  redirect("/admin/management?tab=members");
}
