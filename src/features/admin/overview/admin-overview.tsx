import { useAdminAccess } from "../shell/admin-access";
import { ActivityOverview } from "./activity-overview";
import { SectionDirectory } from "./section-directory";

/** The landing page of administration: how the platform is doing, and where to go from here. */
export function AdminOverview() {
  const access = useAdminAccess();
  return (
    <div className="grid gap-8">
      {access.overview ? <ActivityOverview access={access} /> : null}
      <SectionDirectory access={access} />
    </div>
  );
}
