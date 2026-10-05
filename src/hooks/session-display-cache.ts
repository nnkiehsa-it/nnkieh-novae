import { restoreViewMemoryScope } from "@/lib/view-memory-cache";
import { restoreContentReadCache } from "@/services/content-read-cache";
import { readSessionBootstrapSnapshot } from "@/services/session-bootstrap";
import { seedRuntimeSettings } from "@/services/runtime-settings";
import { seedCategoryCatalog } from "@/hooks/use-categories";

/** Restore display data alongside verification, before any page initializes. */
export async function restoreSessionDisplay(uid: string, current: () => boolean) {
  await Promise.all([
    restoreContentReadCache(),
    restoreViewMemoryScope(uid),
    readSessionBootstrapSnapshot().then((snapshot) => {
      if (!current() || !snapshot) return;
      seedCategoryCatalog(snapshot.catalog);
      seedRuntimeSettings(snapshot.runtime);
    }),
  ]);
}
