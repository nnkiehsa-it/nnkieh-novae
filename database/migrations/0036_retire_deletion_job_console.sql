-- The operations console lists and retries every background job, deletion
-- included, so the deletion-only reader and its retry are gone.
drop function if exists app_api.backend_list_deletion_jobs(text, integer);
drop function if exists app_api.backend_retry_deletion_job(text, uuid);
