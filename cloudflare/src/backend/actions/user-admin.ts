import { asRecord, asString } from "../shared/http.ts";
import { requirePermission } from "./auth.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";

const RESTRICTION_MODES = new Set(["clear", "7d", "30d", "permanent"]);

export async function handleUserAdminAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (action === "getAdminOverview") {
    requirePermission(auth, "dashboard.view");
    const window = asString(payload.window, "24h");
    const hours = window === "7d" ? 168 : window === "30d" ? 720 : 24;
    const { data, error } = await database.call("app_api", "get_admin_overview", {
      window_hours: hours,
    });
    if (error) throw error;
    return asRecord(data);
  }

  requirePermission(auth, "role.manage");

  if (action === "listAdminUsers") {
    const query = asString(payload.query).trim().slice(0, 120);
    const { data, error } = await database.call("app_api", "backend_list_admin_users", {
      search_query: query,
      page_limit: 80,
    });
    if (error) throw error;
    return data;
  }

  if (action === "setUserRestriction") {
    const uid = asString(payload.uid).trim();
    const mode = asString(payload.mode);
    const reason = asString(payload.reason).trim();
    if (!uid || !RESTRICTION_MODES.has(mode)) throw new Error("validation-required");
    if (mode !== "clear" && !reason) throw new Error("validation-required");

    const { data, error } = await database.call("app_api", "backend_set_user_restriction", {
      actor_uid: auth.uid,
      target_uid: uid,
      restriction_mode: mode,
      reason,
    });
    if (error) throw error;
    return data;
  }

  if (action === "listAdminAudit") {
    const query = asString(payload.query).trim().slice(0, 120);
    const { data, error } = await database.call("app_api", "backend_list_admin_audit", {
      search_query: query,
      page_limit: 100,
    });
    if (error) throw error;
    return data;
  }

  throw new Error("invalid-action");
}
