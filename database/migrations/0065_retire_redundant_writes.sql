-- Two writes the app never made, each a second road to something another
-- action already does with more care:
--
-- * A proposal's result is written when a moderator sets its status, which
--   also accepts the same status again with a corrected result.
-- * The feature switches are saved with the category settings, under the
--   revision that keeps two administrators from overwriting each other.
--
-- The three-argument feature update stays: category management calls it.

drop function app_api.backend_update_issue_result(uuid, text, boolean, text, text[], text[], text[]);
drop function app_api.backend_update_platform_features(text, boolean, boolean, boolean);
