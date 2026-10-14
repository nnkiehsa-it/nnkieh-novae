-- The notification reads that created a missing state row through this helper
-- were rewritten; nothing calls it any more, so the runtime role loses it too.
DROP FUNCTION app_api.backend_upsert_notification_state(text);
