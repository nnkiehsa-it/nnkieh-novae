import { redirect } from "next/navigation";
export default function CategoryRedirect() {
  redirect("/admin/management?tab=categories");
}
