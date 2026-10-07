-- Match the console's stable ordering without sorting the entire retained queue.
create index background_jobs_console_recent_idx
  on app_private.background_jobs (created_at desc, id desc);
create index event_deliveries_console_failed_idx
  on app_private.event_deliveries (updated_at desc, id desc) where status = 'failed';
create index external_cleanup_console_oldest_idx
  on app_private.external_cleanup_backlog (created_at, job_id);
create index operational_errors_console_recent_idx
  on app_private.operational_errors (last_at desc, action, code, status);
