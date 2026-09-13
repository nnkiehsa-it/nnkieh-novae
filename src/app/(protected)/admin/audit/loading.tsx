import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton>
      <AdminListSkeleton groups={1} rows={8} />
    </AdminPageSkeleton>
  );
}
