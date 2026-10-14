import { openQueryScope } from "@/lib/query-client";
import { readSessionBootstrapSnapshot } from "@/services/session-bootstrap";
import { seedRuntimeSettings } from "@/services/runtime-settings";
import { seedCategoryCatalog } from "@/hooks/use-categories";

/** Restore what this account last read alongside verification, before any page initializes. */
export async function restoreSessionDisplay(uid: string, current: () => boolean) {
  await openQueryScope(uid);
  const snapshot = readSessionBootstrapSnapshot();
  if (!current() || !snapshot) return;
  seedCategoryCatalog(snapshot.catalog);
  seedRuntimeSettings(snapshot.runtime);
}
