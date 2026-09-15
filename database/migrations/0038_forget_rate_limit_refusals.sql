-- Refusals for asking too often are no longer recorded as operational errors.
--
-- The worker stopped counting them: a rate-limit refusal is the platform
-- answering as it was configured to, not work waiting for an administrator, and
-- on the failure screen it was the one entry nobody could act on. The ones
-- already counted go with it rather than sitting there until they expire.

delete from app_private.operational_errors where status = 429;
