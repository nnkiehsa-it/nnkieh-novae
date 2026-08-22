-- Content versions are authoritative cache validators. Seed them from the
-- migration execution time so a rebuilt database cannot reuse the previous
-- database's version range.

update app_private.content_versions
set version = (extract(epoch from clock_timestamp()) * 1000)::bigint,
    updated_at = now();
