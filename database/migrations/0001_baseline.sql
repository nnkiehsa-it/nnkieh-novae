--
-- Novae PostgreSQL 17 baseline.
-- Generated from the fully migrated application schemas and then stripped of
-- provider-specific roles, policies, extensions, webhooks, and schedulers.
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";

--
-- Name: app_api; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "app_api";


--
-- Name: app_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "app_private";


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: announcement_comments; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."announcement_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "announcement_id" "uuid" NOT NULL,
    "author_uid" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_comment_id" "uuid",
    CONSTRAINT "announcement_comments_content_not_blank" CHECK (("length"("btrim"("content")) > 0)),
    CONSTRAINT "announcement_comments_length_check" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 2000))),
    CONSTRAINT "announcement_comments_parent_not_self" CHECK ((("parent_comment_id" IS NULL) OR ("parent_comment_id" <> "id")))
);


--
-- Name: backend_announcement_comment_to_json("app_private"."announcement_comments", "jsonb"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_announcement_comment_to_json"("comment_record" "app_private"."announcement_comments", "replies" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
  select jsonb_build_object(
    'id', comment_record.id,
    'announcement_id', comment_record.announcement_id,
    'parent_comment_id', comment_record.parent_comment_id,
    'author_uid', comment_record.author_uid,
    'content', comment_record.content,
    'created_at', comment_record.created_at,
    'created_at_ms', floor(extract(epoch from comment_record.created_at) * 1000),
    'replies', replies
  );
$$;


--
-- Name: announcements; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_uid" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "like_count" integer DEFAULT 0 NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "comments_enabled" boolean DEFAULT true NOT NULL,
    CONSTRAINT "announcements_content_not_blank" CHECK (("length"("btrim"("content")) > 0)),
    CONSTRAINT "announcements_counts_non_negative" CHECK ((("like_count" >= 0) AND ("comment_count" >= 0))),
    CONSTRAINT "announcements_text_length_check" CHECK (((("char_length"("title") >= 1) AND ("char_length"("title") <= 120)) AND (("char_length"("content") >= 1) AND ("char_length"("content") <= 5000)))),
    CONSTRAINT "announcements_title_not_blank" CHECK (("length"("btrim"("title")) > 0))
)
WITH ("autovacuum_vacuum_threshold"='50', "autovacuum_vacuum_scale_factor"='0.02', "autovacuum_analyze_threshold"='50', "autovacuum_analyze_scale_factor"='0.05');


--
-- Name: backend_announcement_to_json("app_private"."announcements", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_announcement_to_json"("announcement_record" "app_private"."announcements", "actor_uid" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  current_user_liked boolean;
  global_comments_enabled boolean;
begin
  select exists(
    select 1 from app_private.announcement_likes
    where announcement_id = announcement_record.id and uid = actor_uid
  ) into current_user_liked;
  select announcement_comments_enabled into global_comments_enabled
  from app_private.system_setup where singleton;
  return jsonb_build_object(
    'id', announcement_record.id,
    'author_uid', announcement_record.author_uid,
    'title', announcement_record.title,
    'content', announcement_record.content,
    'like_count', announcement_record.like_count,
    'comment_count', announcement_record.comment_count,
    'comments_enabled', announcement_record.comments_enabled,
    'comments_globally_enabled', coalesce(global_comments_enabled, false),
    'published_at', announcement_record.published_at,
    'published_at_ms', floor(extract(epoch from announcement_record.published_at) * 1000),
    'currentUserLiked', current_user_liked
  );
end;
$$;


--
-- Name: issues; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_uid" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "status" "text" NOT NULL,
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "support_count" integer DEFAULT 0 NOT NULL,
    "support_enabled" boolean DEFAULT true NOT NULL,
    "support_goal" integer,
    "support_deadline_at" timestamp with time zone,
    "response_deadline_at" timestamp with time zone,
    "support_met_at" timestamp with time zone,
    "review_rejection_reason" "text",
    "title_search" "text" DEFAULT ''::"text" NOT NULL,
    "last_actor_uid" "text",
    "result_content" "text",
    "review_approved_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "comments_enabled" boolean DEFAULT true NOT NULL,
    "read_access" "text" NOT NULL,
    "author_visible" boolean NOT NULL,
    "support_deadline_days" integer,
    "response_deadline_days" integer,
    CONSTRAINT "issues_content_not_blank" CHECK (("length"("btrim"("content")) > 0)),
    CONSTRAINT "issues_read_access_check" CHECK (("read_access" = ANY (ARRAY['school'::"text", 'reviewed-school'::"text", 'owner-admin'::"text"]))),
    CONSTRAINT "issues_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'under-review'::"text", 'processing'::"text", 'completed'::"text", 'infeasible'::"text", 'auto-rejected'::"text", 'review-rejected'::"text"]))),
    CONSTRAINT "issues_support_count_non_negative" CHECK (("support_count" >= 0)),
    CONSTRAINT "issues_support_goal_positive" CHECK ((("support_goal" IS NULL) OR ("support_goal" > 0))),
    CONSTRAINT "issues_text_length_check" CHECK (((("char_length"("title") >= 1) AND ("char_length"("title") <= 120)) AND (("char_length"("content") >= 1) AND ("char_length"("content") <= 5000)))),
    CONSTRAINT "issues_title_not_blank" CHECK (("length"("btrim"("title")) > 0))
)
WITH ("autovacuum_vacuum_threshold"='50', "autovacuum_vacuum_scale_factor"='0.05', "autovacuum_analyze_threshold"='50', "autovacuum_analyze_scale_factor"='0.05');


--
-- Name: backend_assert_issue_comment_access("uuid", "text", boolean, "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_assert_issue_comment_access"("issue_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "public_comment_categories" "text"[]) RETURNS "app_private"."issues"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  issue_record app_private.issues%rowtype;
begin
  select * into issue_record
  from app_private.issues
  where id = backend_assert_issue_comment_access.issue_id;

  if not found then
    raise exception 'not-found';
  end if;

  if not actor_is_admin
    and issue_record.author_uid <> actor_uid
    and issue_record.category = any(private_to_owner_categories)
  then
    raise exception 'not-found';
  end if;

  if not actor_is_admin
    and issue_record.author_uid <> actor_uid
    and issue_record.category = any(review_required_categories)
    and issue_record.status in ('under-review', 'review-rejected')
  then
    raise exception 'not-found';
  end if;

  if issue_record.category = any(public_comment_categories)
    and issue_record.status in ('under-review', 'review-rejected')
  then
    raise exception 'not-found';
  end if;

  return issue_record;
end;
$$;


--
-- Name: comments; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid" NOT NULL,
    "author_uid" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_comment_id" "uuid",
    CONSTRAINT "comments_content_not_blank" CHECK (("length"("btrim"("content")) > 0)),
    CONSTRAINT "comments_length_check" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 2000))),
    CONSTRAINT "comments_parent_not_self" CHECK ((("parent_comment_id" IS NULL) OR ("parent_comment_id" <> "id")))
);


--
-- Name: backend_comment_to_json("app_private"."comments", "jsonb"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_comment_to_json"("comment_record" "app_private"."comments", "replies" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
  select jsonb_build_object(
    'id', comment_record.id,
    'issue_id', comment_record.issue_id,
    'parent_comment_id', comment_record.parent_comment_id,
    'author_uid', comment_record.author_uid,
    'content', comment_record.content,
    'created_at', comment_record.created_at,
    'created_at_ms', floor(extract(epoch from comment_record.created_at) * 1000),
    'replies', replies
  );
$$;


--
-- Name: backend_commit_user_avatar("text", "text", "text", "text", "text", integer, "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_commit_user_avatar"("actor_uid" "text", "next_avatar_hash" "text", "next_avatar_public_id" "text", "next_avatar_source_url" "text", "next_cached_photo_url" "text", "next_avatar_version" integer, "next_display_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  previous_public_id text;
  committed_version integer;
begin
  select avatar_public_id into previous_public_id
  from app_private.user_profiles where uid=actor_uid for update;

  committed_version := greatest(coalesce((
    select avatar_version+1 from app_private.user_profiles where uid=actor_uid
  ),1),next_avatar_version);

  insert into app_private.user_profiles(
    uid,avatar_hash,avatar_public_id,avatar_source_url,avatar_checked_at,
    avatar_version,display_name,photo_url,cached_photo_url,updated_at
  ) values(
    actor_uid,next_avatar_hash,next_avatar_public_id,next_avatar_source_url,now(),
    committed_version,next_display_name,next_avatar_source_url,next_cached_photo_url,now()
  ) on conflict(uid) do update set
    avatar_hash=excluded.avatar_hash,
    avatar_public_id=excluded.avatar_public_id,
    avatar_source_url=excluded.avatar_source_url,
    avatar_checked_at=excluded.avatar_checked_at,
    avatar_version=excluded.avatar_version,
    display_name=excluded.display_name,
    photo_url=excluded.photo_url,
    cached_photo_url=excluded.cached_photo_url,
    updated_at=excluded.updated_at;

  if previous_public_id is not null and previous_public_id<>next_avatar_public_id then
    insert into app_private.deletion_jobs(cloudinary_public_id,target_id,target_type)
    values(previous_public_id,actor_uid,'avatar');
  end if;

  return jsonb_build_object(
    'photoUrl',next_cached_photo_url,
    'avatarVersion',committed_version
  );
end;
$$;


--
-- Name: backend_complete_initial_setup("text", "jsonb", "jsonb", boolean, boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_complete_initial_setup"("actor_uid" "text", "issue_categories" "jsonb", "facility_categories" "jsonb", "issues_enabled" boolean, "facilities_enabled" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare setup_record app_private.system_setup%rowtype;
begin
  select * into setup_record from app_private.system_setup where singleton for update;
  if setup_record.completed_at is not null then raise exception 'setup-already-completed'; end if;
  if jsonb_typeof(issue_categories) <> 'array' or jsonb_typeof(facility_categories) <> 'array'
    or (issues_enabled and jsonb_array_length(issue_categories) = 0)
    or (facilities_enabled and jsonb_array_length(facility_categories) = 0) then
    raise exception 'validation-required';
  end if;

  delete from app_private.issue_categories existing where existing.created_by = 'migration'
    and not exists(select 1 from app_private.issues legacy_issue where legacy_issue.category = existing.id)
    and not exists(select 1 from app_private.user_issue_category_assignments assignment where assignment.category_id = existing.id);
  delete from app_private.facility_categories existing where existing.created_by = 'migration'
    and not exists(select 1 from app_private.facility_reports legacy_facility where legacy_facility.category_id = existing.id)
    and not exists(select 1 from app_private.user_facility_category_assignments assignment where assignment.category_id = existing.id);

  if issues_enabled then
    insert into app_private.issue_categories(
      id,label,read_access,author_visible,support_enabled,support_goal,
      support_deadline_days,response_deadline_days,comments_enabled,is_active,is_default,
      sort_order,created_by
    )
    select
      value->>'id', btrim(value->>'label'),
      value->>'readAccess', coalesce((value->>'authorVisible')::boolean,false),
      coalesce((value->>'supportEnabled')::boolean,false),
      nullif(value->>'supportGoal','')::integer,
      nullif(value->>'supportDeadlineDays','')::integer,
      nullif(value->>'responseDeadlineDays','')::integer,
      coalesce((value->>'commentsEnabled')::boolean,true), true, ordinal = 1,
      ordinal - 1, backend_complete_initial_setup.actor_uid
    from jsonb_array_elements(issue_categories) with ordinality as items(value, ordinal)
    on conflict (id) do update set
      label=excluded.label,
      support_enabled=excluded.support_enabled,support_goal=excluded.support_goal,
      support_deadline_days=excluded.support_deadline_days,
      response_deadline_days=excluded.response_deadline_days,
      comments_enabled=excluded.comments_enabled,is_active=true,
      is_default=excluded.is_default,sort_order=excluded.sort_order;
  end if;

  if facilities_enabled then
    insert into app_private.facility_categories(
      id,label,is_active,is_default,sort_order,created_by
    )
    select value->>'id', btrim(value->>'label'),
      true, ordinal = 1, ordinal - 1, backend_complete_initial_setup.actor_uid
    from jsonb_array_elements(facility_categories) with ordinality as items(value, ordinal)
    on conflict (id) do update set
      label=excluded.label,is_active=true,
      is_default=excluded.is_default,sort_order=excluded.sort_order;
  end if;

  update app_private.system_setup set
    completed_at=now(),completed_by=actor_uid,
    issues_enabled=backend_complete_initial_setup.issues_enabled,
    facilities_enabled=backend_complete_initial_setup.facilities_enabled,
    updated_at=now()
  where singleton;
  insert into app_private.category_configuration_audit(domain,operation,actor_uid,after_value)
  values('setup','complete-setup',actor_uid,jsonb_build_object(
    'issuesEnabled',issues_enabled,
    'facilitiesEnabled',facilities_enabled,
    'issueCategoryCount',case when issues_enabled then jsonb_array_length(issue_categories) else 0 end,
    'facilityCategoryCount',case when facilities_enabled then jsonb_array_length(facility_categories) else 0 end
  ));
  return jsonb_build_object(
    'success',true,'setupCompleted',true,
    'issuesEnabled',issues_enabled,'facilitiesEnabled',facilities_enabled
  );
end;
$$;


--
-- Name: backend_create_announcement("text", "text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_create_announcement"("actor_uid" "text", "announcement_title" "text", "announcement_content" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare announcement_record app_private.announcements%rowtype;
begin
  insert into app_private.announcements(author_uid,title,content)
  values(actor_uid,announcement_title,announcement_content)
  returning * into announcement_record;
  return app_api.backend_announcement_to_json(announcement_record,actor_uid);
end;
$$;


--
-- Name: backend_create_announcement_comment("uuid", "uuid", "text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_create_announcement_comment"("announcement_id" "uuid", "parent_comment_id" "uuid", "actor_uid" "text", "comment_content" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  comment_record app_private.announcement_comments%rowtype;
  parent_record app_private.announcement_comments%rowtype;
  next_comment_count integer;
begin
  if parent_comment_id is not null then
    select * into parent_record from app_private.announcement_comments
    where id=backend_create_announcement_comment.parent_comment_id;
    if not found or parent_record.announcement_id<>backend_create_announcement_comment.announcement_id
      or parent_record.parent_comment_id is not null then raise exception 'invalid-parent-comment'; end if;
  end if;
  insert into app_private.announcement_comments(announcement_id,parent_comment_id,author_uid,content)
  values(backend_create_announcement_comment.announcement_id,
    backend_create_announcement_comment.parent_comment_id,actor_uid,comment_content)
  returning * into comment_record;
  select comment_count into next_comment_count from app_private.announcements
  where id=backend_create_announcement_comment.announcement_id;
  return jsonb_build_object(
    'comment',app_api.backend_announcement_comment_to_json(comment_record,'[]'::jsonb),
    'comment_count',coalesce(next_comment_count,0)
  );
end;
$$;


--
-- Name: backend_create_facility("text", "text", "text", "text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_create_facility"("actor_uid" "text", "facility_title" "text", "facility_location" "text", "facility_content" "text", "facility_category" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare facility app_private.facility_reports%rowtype;
begin
  if not exists(select 1 from app_private.facility_categories where id=facility_category and is_active)
    then raise exception 'invalid-facility-category'; end if;
  insert into app_private.facility_reports(
    author_uid,title,title_search,location,content,last_actor_uid,category_id
  ) values(
    actor_uid,facility_title,lower(facility_title),facility_location,
    facility_content,actor_uid,facility_category
  ) returning * into facility;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('facility.created','facility',facility.id::text,actor_uid,jsonb_build_object(
    'title',facility.title,'category_id',facility.category_id,'author_uid',facility.author_uid
  ));
  return to_jsonb(facility) || jsonb_build_object(
    'isOwnFacility',true,'currentUserAffected',true,'canManageFacility',false
  );
end;
$$;


--
-- Name: backend_create_issue("text", "text", "text", "text", "text", boolean, integer, timestamp with time zone, timestamp with time zone, boolean, boolean, "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_create_issue"("actor_uid" "text", "issue_title" "text", "issue_content" "text", "issue_category" "text", "issue_status" "text", "support_enabled" boolean, "support_goal" integer, "support_deadline_at" timestamp with time zone, "response_deadline_at" timestamp with time zone, "author_is_private" boolean, "actor_is_admin" boolean, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "author_private_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare issue_record app_private.issues%rowtype;
begin
  insert into app_private.issues(
    author_uid,category,content,response_deadline_at,review_approved_at,status,
    support_count,support_deadline_at,support_enabled,support_goal,title,title_search
  ) values(
    actor_uid,issue_category,issue_content,response_deadline_at,null,issue_status,
    case when support_enabled then 1 else 0 end,support_deadline_at,
    support_enabled,support_goal,issue_title,lower(issue_title)
  ) returning * into issue_record;
  return app_api.backend_issue_to_json(issue_record,actor_uid,actor_is_admin,
    private_to_owner_categories,review_required_categories,author_private_categories);
end;
$$;


--
-- Name: backend_create_issue_comment("uuid", "uuid", "text", boolean, "text", "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_create_issue_comment"("issue_id" "uuid", "parent_comment_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean, "comment_content" "text", "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "public_comment_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  comment_record app_private.comments%rowtype;
  parent_record app_private.comments%rowtype;
begin
  perform app_api.backend_assert_issue_comment_access(
    issue_id,actor_uid,actor_is_admin,private_to_owner_categories,
    review_required_categories,public_comment_categories
  );
  if parent_comment_id is not null then
    select * into parent_record from app_private.comments
    where id=backend_create_issue_comment.parent_comment_id;
    if not found or parent_record.issue_id<>backend_create_issue_comment.issue_id
      or parent_record.parent_comment_id is not null then raise exception 'invalid-parent-comment'; end if;
  end if;
  insert into app_private.comments(issue_id,parent_comment_id,author_uid,content)
  values(backend_create_issue_comment.issue_id,
    backend_create_issue_comment.parent_comment_id,actor_uid,comment_content)
  returning * into comment_record;
  return app_api.backend_comment_to_json(comment_record,'[]'::jsonb);
end;
$$;


--
-- Name: backend_delete_announcement("uuid"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_delete_announcement"("announcement_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  upload_targets jsonb;
begin
  select jsonb_build_array(jsonb_build_object('id', backend_delete_announcement.announcement_id, 'type', 'announcement'))
    || coalesce(jsonb_agg(jsonb_build_object('id', id, 'type', 'announcement_comment')), '[]'::jsonb)
  into upload_targets
  from app_private.announcement_comments
  where announcement_comments.announcement_id = backend_delete_announcement.announcement_id;

  delete from app_private.announcements
  where id = backend_delete_announcement.announcement_id;

  return jsonb_build_object(
    'success', true,
    'upload_targets', coalesce(upload_targets, jsonb_build_array(jsonb_build_object('id', backend_delete_announcement.announcement_id, 'type', 'announcement')))
  );
end;
$$;


--
-- Name: backend_delete_announcement_comment("uuid", "text", boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_delete_announcement_comment"("comment_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  comment_record app_private.announcement_comments%rowtype;
  upload_targets jsonb;
  next_comment_count integer := 0;
begin
  select * into comment_record
  from app_private.announcement_comments
  where id = backend_delete_announcement_comment.comment_id;

  if found and comment_record.author_uid <> actor_uid and not actor_is_admin then
    raise exception 'permission-denied';
  end if;

  if found then
    select jsonb_build_array(jsonb_build_object('id', backend_delete_announcement_comment.comment_id, 'type', 'announcement_comment'))
      || coalesce(jsonb_agg(jsonb_build_object('id', id, 'type', 'announcement_comment')), '[]'::jsonb)
    into upload_targets
    from app_private.announcement_comments
    where parent_comment_id = backend_delete_announcement_comment.comment_id;
  end if;

  delete from app_private.announcement_comments
  where id = backend_delete_announcement_comment.comment_id;

  if found then
    select comment_count into next_comment_count
    from app_private.announcements
    where id = comment_record.announcement_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'announcement_id', coalesce(comment_record.announcement_id::text, ''),
    'comment_count', coalesce(next_comment_count, 0),
    'upload_targets', coalesce(upload_targets, jsonb_build_array(jsonb_build_object('id', backend_delete_announcement_comment.comment_id, 'type', 'announcement_comment')))
  );
end;
$$;


--
-- Name: backend_delete_facility("uuid", "text", boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_delete_facility"("facility_id" "uuid", "actor_uid" "text", "actor_can_manage" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare facility app_private.facility_reports%rowtype;
begin
  select * into facility from app_private.facility_reports where id=facility_id for update;
  if not found then raise exception 'not-found'; end if;
  if not actor_can_manage and not (facility.author_uid=actor_uid and facility.status='pending') then raise exception 'permission-denied'; end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('facility.deleted','facility',facility.id::text,actor_uid,jsonb_build_object('title',facility.title,'author_uid',facility.author_uid));
  delete from app_private.facility_reports where id=facility_id;
  return jsonb_build_object('success',true,'facilityId',facility_id);
end;
$$;


--
-- Name: backend_delete_facility_category("text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_delete_facility_category"("category_id" "text", "actor_uid" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  category_record app_private.facility_categories%rowtype;
  deleted_count integer;
begin
  if coalesce(btrim(actor_uid), '') = '' or coalesce(btrim(category_id), '') = '' then
    raise exception 'validation-required';
  end if;
  select * into category_record from app_private.facility_categories
    where id = backend_delete_facility_category.category_id for update;
  if not found then raise exception 'not-found'; end if;
  if category_record.is_default then raise exception 'cannot-delete-default-category'; end if;

  insert into app_private.outbox_events(event_type, target_type, target_id, actor_uid, payload)
  select 'facility.deleted', 'facility', facility.id::text, backend_delete_facility_category.actor_uid,
    jsonb_build_object('author_uid', facility.author_uid, 'title', facility.title)
  from app_private.facility_reports facility where facility.category_id = category_record.id;

  delete from app_private.notifications notification
    where notification.target_type = 'facility'
      and notification.target_id in (
        select report.id::text from app_private.facility_reports report where report.category_id = category_record.id
      );
  delete from app_private.facility_reports report where report.category_id = category_record.id;
  get diagnostics deleted_count = row_count;
  delete from app_private.facility_categories where id = category_record.id;

  insert into app_private.category_configuration_audit(domain, category_id, operation, actor_uid, before_value)
  values('facility', category_record.id, 'delete', backend_delete_facility_category.actor_uid, to_jsonb(category_record));
  return jsonb_build_object('success', true, 'deletedRecords', deleted_count);
end;
$$;


--
-- Name: backend_delete_issue("uuid", "text", boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_delete_issue"("issue_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  issue_record app_private.issues%rowtype;
begin
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then return; end if;
  if issue_record.author_uid <> actor_uid and not actor_is_admin then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values (
    'issue.deleted',
    'issue',
    issue_record.id::text,
    actor_uid,
    jsonb_build_object(
      'author_uid', issue_record.author_uid,
      'issue_category', issue_record.category,
      'issue_id', issue_record.id,
      'title', issue_record.title
    )
  );
  delete from app_private.issues where id = issue_record.id;
end;
$$;


--
-- Name: backend_delete_issue_category("text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_delete_issue_category"("category_id" "text", "actor_uid" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  category_record app_private.issue_categories%rowtype;
  deleted_count integer;
begin
  if coalesce(btrim(actor_uid), '') = '' or coalesce(btrim(category_id), '') = '' then
    raise exception 'validation-required';
  end if;
  select * into category_record from app_private.issue_categories
    where id = backend_delete_issue_category.category_id for update;
  if not found then raise exception 'not-found'; end if;
  if category_record.is_default then raise exception 'cannot-delete-default-category'; end if;

  insert into app_private.outbox_events(event_type, target_type, target_id, actor_uid, payload)
  select 'issue.deleted', 'issue', issue.id::text, backend_delete_issue_category.actor_uid,
    jsonb_build_object(
      'author_uid', issue.author_uid,
      'issue_category', issue.category,
      'issue_id', issue.id,
      'supporter_uids', coalesce((
        select jsonb_agg(supporter.uid order by supporter.created_at)
        from app_private.supports supporter where supporter.issue_id = issue.id
      ), '[]'::jsonb),
      'title', issue.title
    )
  from app_private.issues issue where issue.category = category_record.id;

  delete from app_private.notifications notification
    where notification.target_type = 'issue'
      and notification.target_id in (select id::text from app_private.issues where category = category_record.id);
  delete from app_private.issues where category = category_record.id;
  get diagnostics deleted_count = row_count;
  delete from app_private.issue_categories where id = category_record.id;

  insert into app_private.category_configuration_audit(domain, category_id, operation, actor_uid, before_value)
  values('issue', category_record.id, 'delete', backend_delete_issue_category.actor_uid, to_jsonb(category_record));
  return jsonb_build_object('success', true, 'deletedRecords', deleted_count);
end;
$$;


--
-- Name: backend_delete_issue_comment("uuid", "text", boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_delete_issue_comment"("comment_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  comment_record app_private.comments%rowtype;
  upload_targets jsonb;
begin
  select * into comment_record
  from app_private.comments
  where id = backend_delete_issue_comment.comment_id;

  if found and comment_record.author_uid <> actor_uid and not actor_is_admin then
    raise exception 'permission-denied';
  end if;

  if found then
    select jsonb_build_array(jsonb_build_object('id', backend_delete_issue_comment.comment_id, 'type', 'comment'))
      || coalesce(jsonb_agg(jsonb_build_object('id', id, 'type', 'comment')), '[]'::jsonb)
    into upload_targets
    from app_private.comments
    where parent_comment_id = backend_delete_issue_comment.comment_id;
  end if;

  delete from app_private.comments
  where id = backend_delete_issue_comment.comment_id;

  return jsonb_build_object(
    'success', true,
    'upload_targets', coalesce(upload_targets, jsonb_build_array(jsonb_build_object('id', backend_delete_issue_comment.comment_id, 'type', 'comment')))
  );
end;
$$;


--
-- Name: backend_delete_issue_with_upload_targets("uuid", "text", boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_delete_issue_with_upload_targets"("issue_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  issue_record app_private.issues%rowtype;
  upload_targets jsonb;
  supporter_uids jsonb;
begin
  select * into issue_record
  from app_private.issues
  where id = backend_delete_issue_with_upload_targets.issue_id
  for update;

  if not found then
    return jsonb_build_object('success', true, 'issueId', issue_id, 'upload_targets', '[]'::jsonb);
  end if;

  if issue_record.author_uid <> actor_uid and not actor_is_admin then
    raise exception 'permission-denied';
  end if;

  select jsonb_build_array(jsonb_build_object('id', issue_record.id, 'type', 'issue'))
    || coalesce(jsonb_agg(jsonb_build_object('id', id, 'type', 'comment')), '[]'::jsonb)
  into upload_targets
  from app_private.comments
  where comments.issue_id = issue_record.id;

  select coalesce(jsonb_agg(supporter.uid order by supporter.created_at), '[]'::jsonb)
  into supporter_uids
  from app_private.supports supporter
  where supporter.issue_id = issue_record.id;

  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values (
    'issue.deleted',
    'issue',
    issue_record.id::text,
    actor_uid,
    jsonb_build_object(
      'author_uid', issue_record.author_uid,
      'issue_category', issue_record.category,
      'issue_id', issue_record.id,
      'supporter_uids', supporter_uids,
      'title', issue_record.title
    )
  );

  delete from app_private.issues
  where id = issue_record.id;

  return jsonb_build_object(
    'success', true,
    'issueId', issue_record.id,
    'upload_targets', upload_targets
  );
end;
$$;


--
-- Name: backend_get_access_context("text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_get_access_context"("actor_uid" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
  with assigned_roles as (
    select role_code from app_private.user_role_assignments
    where uid=backend_get_access_context.actor_uid
  ), assigned_issue_categories as (
    select category_id from app_private.user_issue_category_assignments
    where uid=backend_get_access_context.actor_uid
  ), assigned_facility_categories as (
    select category_id from app_private.user_facility_category_assignments
    where uid=backend_get_access_context.actor_uid
  ), granted_permissions as (
    select distinct role_permission.permission_code
    from app_private.role_permissions role_permission
    join assigned_roles assigned_role on assigned_role.role_code=role_permission.role_code
  )
  select jsonb_build_object(
    'roles',coalesce((select jsonb_agg(role_code order by role_code) from assigned_roles),'[]'::jsonb),
    'managedIssueCategoryIds',coalesce((select jsonb_agg(category_id order by category_id) from assigned_issue_categories),'[]'::jsonb),
    'managedFacilityCategoryIds',coalesce((select jsonb_agg(category_id order by category_id) from assigned_facility_categories),'[]'::jsonb),
    'permissions',coalesce((select jsonb_agg(permission_code order by permission_code) from granted_permissions),'[]'::jsonb),
    'setupCompleted',coalesce((select completed_at is not null from app_private.system_setup where singleton),false)
  );
$$;


--
-- Name: backend_get_announcement("uuid", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_get_announcement"("announcement_id" "uuid", "actor_uid" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  announcement_record app_private.announcements%rowtype;
begin
  select * into announcement_record
  from app_private.announcements
  where id = backend_get_announcement.announcement_id;

  if not found then
    raise exception 'not-found';
  end if;

  return app_api.backend_announcement_to_json(announcement_record, actor_uid);
end;
$$;


--
-- Name: backend_get_facility("uuid", "text", boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_get_facility"("facility_id" "uuid", "actor_uid" "text", "actor_can_manage" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare facility app_private.facility_reports%rowtype; affected boolean;
begin
  select * into facility from app_private.facility_reports where id = facility_id;
  if not found then raise exception 'not-found'; end if;
  select facility.author_uid = actor_uid or exists(select 1 from app_private.facility_report_affected_users a where a.facility_id = facility.id and a.uid = actor_uid) into affected;
  return to_jsonb(facility) || jsonb_build_object('isOwnFacility',facility.author_uid = actor_uid,'currentUserAffected',affected,'canManageFacility',actor_can_manage);
end;
$$;


--
-- Name: backend_get_issue("uuid", "text", boolean, "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_get_issue"("issue_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "author_private_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  issue_record app_private.issues%rowtype;
begin
  select * into issue_record
  from app_private.issues
  where id = backend_get_issue.issue_id;

  if not found then
    raise exception 'not-found';
  end if;

  return app_api.backend_issue_to_json(
    issue_record,
    actor_uid,
    actor_is_admin,
    private_to_owner_categories,
    review_required_categories,
    author_private_categories
  );
end;
$$;


--
-- Name: backend_get_notification_read_state("text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_get_notification_read_state"("actor_uid" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
  select coalesce(
    (
      select app_api.backend_notification_state_to_json(state_record)
      from app_private.notification_states state_record
      where state_record.uid = actor_uid
    ),
    jsonb_build_object(
      'uid', actor_uid,
      'broadcast_opened_at_ms', null,
      'admin_opened_at_ms', null,
      'user_opened_at_ms', null,
      'push_comments_enabled', true,
      'push_issue_updates_enabled', true
    )
  );
$$;


--
-- Name: backend_get_notification_unread_hint("text", boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_get_notification_unread_hint"("actor_uid" "text", "actor_is_admin" boolean) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  with state as (
    select
      coalesce(broadcast_opened_at, '-infinity'::timestamptz) as broadcast_opened_at,
      coalesce(admin_opened_at, '-infinity'::timestamptz) as admin_opened_at,
      coalesce(user_opened_at, '-infinity'::timestamptz) as user_opened_at
    from app_private.notification_states
    where uid = backend_get_notification_unread_hint.actor_uid
  ), normalized_state as (
    select * from state
    union all
    select '-infinity'::timestamptz, '-infinity'::timestamptz, '-infinity'::timestamptz
    where not exists (select 1 from state)
  )
  select jsonb_build_object('hasUnread', exists (
    select 1
    from app_private.notifications notification, normalized_state opened
    where notification.expires_at > now()
      and (
        (notification.source = 'broadcast' and notification.created_at > opened.broadcast_opened_at)
        or (notification.source = 'user' and notification.recipient_uid = backend_get_notification_unread_hint.actor_uid and notification.created_at > opened.user_opened_at)
        or (backend_get_notification_unread_hint.actor_is_admin and notification.source = 'admin' and notification.created_at > opened.admin_opened_at)
      )
    limit 1
  ));
$$;


--
-- Name: backend_get_session_bootstrap_snapshot("text", boolean, "text", "text", "text", boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_get_session_bootstrap_snapshot"("actor_uid" "text", "actor_is_admin" boolean, "actor_email" "text", "actor_name" "text", "actor_photo_url" "text", "record_visit" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  issue_categories jsonb;
  facility_categories jsonb;
  features jsonb;
  versions jsonb;
begin
  if coalesce(record_visit, false) then
    insert into app_private.user_profiles(
      uid, email, display_name, photo_url, last_seen_at, updated_at
    ) values (
      actor_uid, lower(actor_email), actor_name, actor_photo_url, now(), now()
    )
    on conflict (uid) do update set
      email = excluded.email,
      display_name = excluded.display_name,
      photo_url = excluded.photo_url,
      last_seen_at = case
        when user_profiles.last_seen_at is null
          or user_profiles.last_seen_at <= now() - interval '24 hours'
          then excluded.last_seen_at
        else user_profiles.last_seen_at
      end,
      updated_at = excluded.updated_at
    where user_profiles.email is distinct from excluded.email
      or user_profiles.display_name is distinct from excluded.display_name
      or user_profiles.photo_url is distinct from excluded.photo_url
      or user_profiles.last_seen_at is null
      or user_profiles.last_seen_at <= now() - interval '24 hours';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'authorVisible', category.author_visible,
    'commentsEnabled', category.comments_enabled,
    'id', category.id,
    'isDefault', category.is_default,
    'label', category.label,
    'readAccess', category.read_access,
    'responseDeadlineDays', category.response_deadline_days,
    'sortOrder', category.sort_order,
    'supportDeadlineDays', category.support_deadline_days,
    'supportEnabled', category.support_enabled,
    'supportGoal', category.support_goal
  ) order by category.sort_order, category.created_at, category.id), '[]'::jsonb)
  into issue_categories
  from app_private.issue_categories category;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', category.id,
    'isDefault', category.is_default,
    'label', category.label,
    'sortOrder', category.sort_order
  ) order by category.sort_order, category.created_at, category.id), '[]'::jsonb)
  into facility_categories
  from app_private.facility_categories category;

  select coalesce(jsonb_build_object(
    'announcementCommentsEnabled', setup.announcement_comments_enabled,
    'facilitiesEnabled', setup.facilities_enabled,
    'issuesEnabled', setup.issues_enabled
  ), jsonb_build_object(
    'announcementCommentsEnabled', true,
    'facilitiesEnabled', true,
    'issuesEnabled', true
  ))
  into features
  from app_private.system_setup setup
  where setup.singleton;

  if features is null then
    features := jsonb_build_object(
      'announcementCommentsEnabled', true,
      'facilitiesEnabled', true,
      'issuesEnabled', true
    );
  end if;

  select jsonb_build_object(
    'announcements', coalesce(max(version) filter (where domain = 'announcements'), 1),
    'facilities', coalesce(max(version) filter (where domain = 'facilities'), 1),
    'issues', coalesce(max(version) filter (where domain = 'issues'), 1)
  )
  into versions
  from app_private.content_versions;

  return jsonb_build_object(
    'catalog', jsonb_build_object(
      'issueCategories', issue_categories,
      'facilityCategories', facility_categories,
      'features', features
    ),
    'notificationUnread', app_api.backend_get_notification_unread_hint(actor_uid, actor_is_admin),
    'versions', versions,
    'visitRecorded', coalesce(record_visit, false)
  );
end;
$$;


--
-- Name: backend_issue_list_to_json("app_private"."issues", "text", boolean, boolean, "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_issue_list_to_json"("issue_record" "app_private"."issues", "actor_uid" "text", "actor_is_admin" boolean, "current_user_supported" boolean, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "author_private_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  is_own_issue boolean := issue_record.author_uid = actor_uid;
  can_manage_issue boolean := actor_is_admin or is_own_issue;
  can_view_author boolean := actor_is_admin or is_own_issue or issue_record.author_visible;
begin
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'owner-admin' then raise exception 'not-found'; end if;
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'reviewed-school'
    and issue_record.status in ('under-review','review-rejected') then raise exception 'not-found'; end if;
  return jsonb_build_object(
    'id',issue_record.id,'title',issue_record.title,'created_at',issue_record.created_at,'closed_at',issue_record.closed_at,
    'created_at_ms',floor(extract(epoch from issue_record.created_at)*1000),
    'closed_at_ms',case when issue_record.closed_at is null then null else floor(extract(epoch from issue_record.closed_at)*1000) end,
    'support_count',issue_record.support_count,'status',issue_record.status,'category',issue_record.category,
    'comments_enabled',issue_record.comments_enabled,'read_access',issue_record.read_access,
    'support_enabled',issue_record.support_enabled,'support_goal',issue_record.support_goal,
    'support_deadline_at',issue_record.support_deadline_at,
    'support_deadline_at_ms',case when issue_record.support_deadline_at is null then null else floor(extract(epoch from issue_record.support_deadline_at)*1000) end,
    'response_deadline_at',issue_record.response_deadline_at,
    'response_deadline_at_ms',case when issue_record.response_deadline_at is null then null else floor(extract(epoch from issue_record.response_deadline_at)*1000) end,
    'review_approved_at',issue_record.review_approved_at,
    'review_approved_at_ms',case when issue_record.review_approved_at is null then null else floor(extract(epoch from issue_record.review_approved_at)*1000) end,
    'result_content',issue_record.result_content,'support_met_at',issue_record.support_met_at,
    'support_met_at_ms',case when issue_record.support_met_at is null then null else floor(extract(epoch from issue_record.support_met_at)*1000) end,
    'review_rejection_reason',issue_record.review_rejection_reason,
    'currentUserSupported',current_user_supported,'isOwnIssue',is_own_issue,
    'canManageIssue',can_manage_issue,'canViewAuthor',can_view_author,
    'author_uid',case when can_view_author then issue_record.author_uid else null end
  );
end;
$$;


--
-- Name: backend_issue_to_json("app_private"."issues", "text", boolean, "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_issue_to_json"("issue_record" "app_private"."issues", "actor_uid" "text", "actor_is_admin" boolean, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "author_private_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  is_own_issue boolean := issue_record.author_uid = actor_uid;
  can_manage_issue boolean := actor_is_admin or is_own_issue;
  can_view_author boolean := actor_is_admin or is_own_issue or issue_record.author_visible;
  current_user_supported boolean;
begin
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'owner-admin' then
    raise exception 'not-found';
  end if;
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'reviewed-school'
    and issue_record.status in ('under-review','review-rejected') then
    raise exception 'not-found';
  end if;
  select exists(select 1 from app_private.supports support
    where support.issue_id=issue_record.id and support.uid=actor_uid) into current_user_supported;
  return jsonb_build_object(
    'id',issue_record.id,'title',issue_record.title,'content',issue_record.content,
    'created_at',issue_record.created_at,'closed_at',issue_record.closed_at,
    'created_at_ms',floor(extract(epoch from issue_record.created_at)*1000),
    'closed_at_ms',case when issue_record.closed_at is null then null else floor(extract(epoch from issue_record.closed_at)*1000) end,
    'support_count',issue_record.support_count,'status',issue_record.status,'category',issue_record.category,
    'comments_enabled',issue_record.comments_enabled,'read_access',issue_record.read_access,
    'support_enabled',issue_record.support_enabled,'support_goal',issue_record.support_goal,
    'support_deadline_at',issue_record.support_deadline_at,
    'support_deadline_at_ms',case when issue_record.support_deadline_at is null then null else floor(extract(epoch from issue_record.support_deadline_at)*1000) end,
    'response_deadline_at',issue_record.response_deadline_at,
    'response_deadline_at_ms',case when issue_record.response_deadline_at is null then null else floor(extract(epoch from issue_record.response_deadline_at)*1000) end,
    'review_approved_at',issue_record.review_approved_at,
    'review_approved_at_ms',case when issue_record.review_approved_at is null then null else floor(extract(epoch from issue_record.review_approved_at)*1000) end,
    'result_content',issue_record.result_content,'support_met_at',issue_record.support_met_at,
    'support_met_at_ms',case when issue_record.support_met_at is null then null else floor(extract(epoch from issue_record.support_met_at)*1000) end,
    'review_rejection_reason',issue_record.review_rejection_reason,
    'currentUserSupported',current_user_supported,'isOwnIssue',is_own_issue,
    'canManageIssue',can_manage_issue,'canViewAuthor',can_view_author,
    'author_uid',case when can_view_author then issue_record.author_uid else null end
  );
end;
$$;


--
-- Name: backend_list_announcement_comments("uuid", "uuid", timestamp with time zone); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_announcement_comments"("announcement_id" "uuid", "cursor_id" "uuid", "cursor_created_at" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  page_size integer := 20;
  rows_json jsonb := '[]'::jsonb;
  last_comment jsonb;
  comment_record app_private.announcement_comments%rowtype;
  reply_rows jsonb;
begin
  for comment_record in
    select *
    from app_private.announcement_comments
    where announcement_comments.announcement_id = backend_list_announcement_comments.announcement_id
      and parent_comment_id is null
      and (
        cursor_id is null
        or created_at > cursor_created_at
        or (created_at = cursor_created_at and id > cursor_id)
      )
    order by created_at asc, id asc
    limit page_size + 1
  loop
    select coalesce(jsonb_agg(app_api.backend_announcement_comment_to_json(reply, '[]'::jsonb) order by reply.created_at asc, reply.id asc), '[]'::jsonb)
    into reply_rows
    from app_private.announcement_comments reply
    where reply.parent_comment_id = comment_record.id;

    rows_json := rows_json || jsonb_build_array(app_api.backend_announcement_comment_to_json(comment_record, reply_rows));
  end loop;

  last_comment := rows_json -> (page_size - 1);

  return jsonb_build_object(
    'comments', (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select value
        from jsonb_array_elements(rows_json) with ordinality as items(value, position)
        where position <= page_size
        order by position
      ) limited_rows
    ),
    'hasMore', jsonb_array_length(rows_json) > page_size,
    'cursor', case
      when jsonb_array_length(rows_json) > page_size and last_comment is not null then
        jsonb_build_object('id', last_comment ->> 'id', 'createdAtMs', last_comment -> 'created_at_ms')
      else null
    end
  );
end;
$$;


--
-- Name: backend_list_announcement_comments("uuid", "uuid", timestamp with time zone, integer, "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_announcement_comments"("announcement_id" "uuid", "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "page_size" integer, "sort_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  limited_page_size integer := least(greatest(coalesce(page_size, 30), 1), 30);
  normalized_sort text := case when sort_name = 'oldest' then 'oldest' else 'newest' end;
begin
  return (
    with root_page as materialized (
      select root.*
      from app_private.announcement_comments root
      where root.announcement_id = backend_list_announcement_comments.announcement_id
        and root.parent_comment_id is null
        and (
          cursor_id is null
          or (normalized_sort = 'oldest' and (
            root.created_at > cursor_created_at
            or (root.created_at = cursor_created_at and root.id > cursor_id)
          ))
          or (normalized_sort = 'newest' and (
            root.created_at < cursor_created_at
            or (root.created_at = cursor_created_at and root.id < cursor_id)
          ))
        )
      order by
        case when normalized_sort = 'oldest' then root.created_at end asc,
        case when normalized_sort = 'newest' then root.created_at end desc,
        case when normalized_sort = 'oldest' then root.id end asc,
        case when normalized_sort = 'newest' then root.id end desc
      limit limited_page_size + 1
    ),
    limited_roots as materialized (
      select *
      from root_page
      order by
        case when normalized_sort = 'oldest' then created_at end asc,
        case when normalized_sort = 'newest' then created_at end desc,
        case when normalized_sort = 'oldest' then id end asc,
        case when normalized_sort = 'newest' then id end desc
      limit limited_page_size
    ),
    reply_groups as materialized (
      select
        reply.parent_comment_id,
        jsonb_agg(
          app_api.backend_announcement_comment_to_json(reply, '[]'::jsonb)
          order by reply.created_at asc, reply.id asc
        ) as replies
      from app_private.announcement_comments reply
      where reply.parent_comment_id in (select id from limited_roots)
      group by reply.parent_comment_id
    ),
    page_items as (
      select
        root.id,
        root.created_at,
        app_api.backend_announcement_comment_to_json(
          root,
          coalesce(reply_groups.replies, '[]'::jsonb)
        ) as value
      from limited_roots root
      left join reply_groups on reply_groups.parent_comment_id = root.id
    ),
    last_item as (
      select id, created_at
      from limited_roots
      order by
        case when normalized_sort = 'oldest' then created_at end asc,
        case when normalized_sort = 'newest' then created_at end desc,
        case when normalized_sort = 'oldest' then id end asc,
        case when normalized_sort = 'newest' then id end desc
      offset (limited_page_size - 1)
      limit 1
    )
    select jsonb_build_object(
      'comments', coalesce(
        (select jsonb_agg(
          value order by
            case when normalized_sort = 'oldest' then created_at end asc,
            case when normalized_sort = 'newest' then created_at end desc,
            case when normalized_sort = 'oldest' then id end asc,
            case when normalized_sort = 'newest' then id end desc
        ) from page_items),
        '[]'::jsonb
      ),
      'hasMore', (select count(*) > limited_page_size from root_page),
      'cursor', case
        when (select count(*) > limited_page_size from root_page) then (
          select jsonb_build_object(
            'id', id,
            'createdAtMs', floor(extract(epoch from created_at) * 1000)
          )
          from last_item
        )
        else null
      end
    )
  );
end;
$$;


--
-- Name: backend_list_announcements("text", integer, "uuid", timestamp with time zone); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_announcements"("actor_uid" "text", "page_size" integer, "cursor_id" "uuid", "cursor_published_at" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
  with settings as (
    select least(greatest(coalesce(page_size,30),1),50) as limited_page_size,
      coalesce((select announcement_comments_enabled from app_private.system_setup where singleton),false)
        as global_comments_enabled
  ), liked_ids as materialized (
    select announcement_id from app_private.announcement_likes where uid=actor_uid
  ), page_rows as materialized (
    select announcement.id,announcement.author_uid,announcement.title,
      announcement.like_count,announcement.comment_count,announcement.comments_enabled,
      (select global_comments_enabled from settings) as comments_globally_enabled,
      announcement.published_at,liked_ids.announcement_id is not null as current_user_liked
    from app_private.announcements announcement
    left join liked_ids on liked_ids.announcement_id=announcement.id
    where cursor_id is null or announcement.published_at<cursor_published_at
      or (announcement.published_at=cursor_published_at and announcement.id<cursor_id)
    order by announcement.published_at desc,announcement.id desc
    limit (select limited_page_size+1 from settings)
  ), limited_rows as (
    select * from page_rows order by published_at desc,id desc
    limit (select limited_page_size from settings)
  ), last_item as (
    select id,published_at from limited_rows order by published_at asc,id asc limit 1
  )
  select jsonb_build_object(
    'announcements',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'author_uid',author_uid,'title',title,'like_count',like_count,
      'comment_count',comment_count,'comments_enabled',comments_enabled,
      'comments_globally_enabled',comments_globally_enabled,
      'published_at_ms',floor(extract(epoch from published_at)*1000),
      'currentUserLiked',current_user_liked
    ) order by published_at desc,id desc) from limited_rows),'[]'::jsonb),
    'hasMore',(select count(*)>(select limited_page_size from settings) from page_rows),
    'cursor',case when (select count(*)>(select limited_page_size from settings) from page_rows)
      then (select jsonb_build_object('id',id,'publishedAtMs',floor(extract(epoch from published_at)*1000)) from last_item)
      else null end
  );
$$;


--
-- Name: backend_list_announcements_snapshot("text", integer, "uuid", timestamp with time zone); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_announcements_snapshot"("actor_uid" "text", "page_size" integer, "cursor_id" "uuid", "cursor_published_at" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
  select coalesce(app_api.backend_list_announcements(
    actor_uid, page_size, cursor_id, cursor_published_at
  ), '{}'::jsonb) || jsonb_build_object(
    'version', coalesce((
      select version from app_private.content_versions where domain = 'announcements'
    ), 1)
  );
$$;


--
-- Name: backend_list_facilities("text", boolean, "text"[], "text", "text", "text", "text", "text", timestamp with time zone, integer, "uuid", integer); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_facilities"("actor_uid" "text", "actor_is_admin" boolean, "managed_category_ids" "text"[], "category_filter" "text", "bucket" "text", "status_filter" "text", "search_query" "text", "sort_name" "text", "cursor_created_at" timestamp with time zone, "cursor_number" integer, "cursor_id" "uuid", "page_size" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  rows_json jsonb;
  fetched integer;
  effective_size integer := least(greatest(page_size,1),50);
begin
  if not exists(select 1 from app_private.facility_categories category
    where category.id=category_filter and category.is_active) then
    raise exception 'invalid-facility-category';
  end if;
  with candidates as (
    select facility.*,
      facility.author_uid=actor_uid or exists(
        select 1 from app_private.facility_report_affected_users affected
        where affected.facility_id=facility.id and affected.uid=actor_uid
      ) as current_user_affected,
      actor_is_admin or facility.category_id=any(coalesce(managed_category_ids,array[]::text[])) as can_manage_facility
    from app_private.facility_reports facility
    where facility.category_id=category_filter
      and (case when bucket='closed' then facility.status in ('completed','unable-to-handle')
        else facility.status in ('pending','processing') end)
      and (coalesce(status_filter,'')='' or facility.status=status_filter)
      and (coalesce(search_query,'')='' or facility.title_search like '%'||lower(search_query)||'%'
        or lower(facility.location) like '%'||lower(search_query)||'%')
      and (cursor_id is null or case when sort_name='most-affected'
        then (facility.affected_count,facility.id)<(cursor_number,cursor_id)
        else (facility.created_at,facility.id)<(cursor_created_at,cursor_id) end)
    order by case when sort_name='most-affected' then facility.affected_count end desc,
      case when sort_name<>'most-affected' then facility.created_at end desc,facility.id desc
    limit effective_size+1
  ), selected as (select * from candidates limit effective_size)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'category_id',category_id,'title',title,'location',location,
    'status',status,'affected_count',affected_count,'author_uid',author_uid,
    'created_at',created_at,'updated_at',updated_at,'isOwnFacility',author_uid=actor_uid,
    'currentUserAffected',current_user_affected,'canManageFacility',can_manage_facility
  ) order by case when sort_name='most-affected' then affected_count end desc,
    case when sort_name<>'most-affected' then created_at end desc,id desc),'[]'::jsonb),
    (select count(*) from candidates)
  into rows_json,fetched from selected;
  return jsonb_build_object('facilities',rows_json,'hasMore',fetched>effective_size);
end;
$$;


--
-- Name: backend_list_facilities_snapshot("text", boolean, "text"[], "text", "text", "text", "text", "text", timestamp with time zone, integer, "uuid", integer); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_facilities_snapshot"("actor_uid" "text", "actor_is_admin" boolean, "managed_category_ids" "text"[], "category_filter" "text", "bucket" "text", "status_filter" "text", "search_query" "text", "sort_name" "text", "cursor_created_at" timestamp with time zone, "cursor_number" integer, "cursor_id" "uuid", "page_size" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  result jsonb;
  content_version bigint;
begin
  result := app_api.backend_list_facilities(
    actor_uid, actor_is_admin, managed_category_ids, category_filter, bucket,
    status_filter, search_query, sort_name, cursor_created_at, cursor_number,
    cursor_id, page_size
  );
  select version into content_version from app_private.content_versions where domain = 'facilities';
  return coalesce(result, '{}'::jsonb) || jsonb_build_object('version', coalesce(content_version, 1));
end;
$$;


--
-- Name: backend_list_issue_comments("uuid", "text", boolean, "uuid", timestamp with time zone, "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_issue_comments"("issue_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean, "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "public_comment_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  page_size integer := 20;
  rows_json jsonb := '[]'::jsonb;
  last_comment jsonb;
  comment_record app_private.comments%rowtype;
  reply_rows jsonb;
begin
  perform app_api.backend_assert_issue_comment_access(
    issue_id,
    actor_uid,
    actor_is_admin,
    private_to_owner_categories,
    review_required_categories,
    public_comment_categories
  );

  for comment_record in
    select *
    from app_private.comments
    where comments.issue_id = backend_list_issue_comments.issue_id
      and parent_comment_id is null
      and (
        cursor_id is null
        or created_at > cursor_created_at
        or (created_at = cursor_created_at and id > cursor_id)
      )
    order by created_at asc, id asc
    limit page_size + 1
  loop
    select coalesce(jsonb_agg(app_api.backend_comment_to_json(reply, '[]'::jsonb) order by reply.created_at asc, reply.id asc), '[]'::jsonb)
    into reply_rows
    from app_private.comments reply
    where reply.parent_comment_id = comment_record.id;

    rows_json := rows_json || jsonb_build_array(app_api.backend_comment_to_json(comment_record, reply_rows));
  end loop;

  last_comment := rows_json -> (page_size - 1);

  return jsonb_build_object(
    'comments', (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select value
        from jsonb_array_elements(rows_json) with ordinality as items(value, position)
        where position <= page_size
        order by position
      ) limited_rows
    ),
    'hasMore', jsonb_array_length(rows_json) > page_size,
    'cursor', case
      when jsonb_array_length(rows_json) > page_size and last_comment is not null then
        jsonb_build_object('id', last_comment ->> 'id', 'createdAtMs', last_comment -> 'created_at_ms')
      else null
    end
  );
end;
$$;


--
-- Name: backend_list_issue_comments("uuid", "text", boolean, "uuid", timestamp with time zone, integer, "text", "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_issue_comments"("issue_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean, "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "page_size" integer, "sort_name" "text", "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "public_comment_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  limited_page_size integer := least(greatest(coalesce(page_size, 30), 1), 30);
  normalized_sort text := case when sort_name = 'oldest' then 'oldest' else 'newest' end;
begin
  perform app_api.backend_assert_issue_comment_access(
    issue_id,
    actor_uid,
    actor_is_admin,
    private_to_owner_categories,
    review_required_categories,
    public_comment_categories
  );

  return (
    with root_page as materialized (
      select root.*
      from app_private.comments root
      where root.issue_id = backend_list_issue_comments.issue_id
        and root.parent_comment_id is null
        and (
          cursor_id is null
          or (normalized_sort = 'oldest' and (
            root.created_at > cursor_created_at
            or (root.created_at = cursor_created_at and root.id > cursor_id)
          ))
          or (normalized_sort = 'newest' and (
            root.created_at < cursor_created_at
            or (root.created_at = cursor_created_at and root.id < cursor_id)
          ))
        )
      order by
        case when normalized_sort = 'oldest' then root.created_at end asc,
        case when normalized_sort = 'newest' then root.created_at end desc,
        case when normalized_sort = 'oldest' then root.id end asc,
        case when normalized_sort = 'newest' then root.id end desc
      limit limited_page_size + 1
    ),
    limited_roots as materialized (
      select *
      from root_page
      order by
        case when normalized_sort = 'oldest' then created_at end asc,
        case when normalized_sort = 'newest' then created_at end desc,
        case when normalized_sort = 'oldest' then id end asc,
        case when normalized_sort = 'newest' then id end desc
      limit limited_page_size
    ),
    reply_groups as materialized (
      select
        reply.parent_comment_id,
        jsonb_agg(
          app_api.backend_comment_to_json(reply, '[]'::jsonb)
          order by reply.created_at asc, reply.id asc
        ) as replies
      from app_private.comments reply
      where reply.parent_comment_id in (select id from limited_roots)
      group by reply.parent_comment_id
    ),
    page_items as (
      select
        root.id,
        root.created_at,
        app_api.backend_comment_to_json(root, coalesce(reply_groups.replies, '[]'::jsonb)) as value
      from limited_roots root
      left join reply_groups on reply_groups.parent_comment_id = root.id
    ),
    last_item as (
      select id, created_at
      from limited_roots
      order by
        case when normalized_sort = 'oldest' then created_at end asc,
        case when normalized_sort = 'newest' then created_at end desc,
        case when normalized_sort = 'oldest' then id end asc,
        case when normalized_sort = 'newest' then id end desc
      offset (limited_page_size - 1)
      limit 1
    )
    select jsonb_build_object(
      'comments', coalesce(
        (select jsonb_agg(
          value order by
            case when normalized_sort = 'oldest' then created_at end asc,
            case when normalized_sort = 'newest' then created_at end desc,
            case when normalized_sort = 'oldest' then id end asc,
            case when normalized_sort = 'newest' then id end desc
        ) from page_items),
        '[]'::jsonb
      ),
      'hasMore', (select count(*) > limited_page_size from root_page),
      'cursor', case
        when (select count(*) > limited_page_size from root_page) then (
          select jsonb_build_object(
            'id', id,
            'createdAtMs', floor(extract(epoch from created_at) * 1000)
          )
          from last_item
        )
        else null
      end
    )
  );
end;
$$;


--
-- Name: backend_list_issues("text", "text", boolean, "text", "text", "text", integer, "text", "uuid", timestamp with time zone, timestamp with time zone, integer, "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_issues"("action_name" "text", "actor_uid" "text", "actor_is_admin" boolean, "active_filter" "text", "status_bucket" "text", "sort_name" "text", "page_size" integer, "title_query" "text", "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "cursor_sort_date" timestamp with time zone, "cursor_sort_number" integer, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "author_private_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  effective_sort_name text := case
    when coalesce(status_bucket, 'active') = 'closed' then 'latest'
    else coalesce(sort_name, 'latest')
  end;
  limited_page_size integer := least(greatest(coalesce(page_size, 30), 1), 50);
  rows_json jsonb := '[]'::jsonb;
  last_issue jsonb;
  page_row record;
begin
  for page_row in
    select
      issue_record,
      exists (
        select 1
        from app_private.supports support
        where support.issue_id = issue_record.id
          and support.uid = actor_uid
      ) as current_user_supported
    from app_private.issues issue_record
    where issue_record.category = active_filter
      and (
        actor_is_admin
        or issue_record.author_uid = actor_uid
        or issue_record.category <> all(private_to_owner_categories)
      )
      and (
        actor_is_admin
        or issue_record.author_uid = actor_uid
        or not (
          issue_record.category = any(review_required_categories)
          and issue_record.status in ('under-review', 'review-rejected')
        )
      )
      and (
        case
          when coalesce(status_bucket, 'active') = 'closed' then
            case
              when actor_is_admin or issue_record.category = any(private_to_owner_categories)
                then issue_record.status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed')
              else issue_record.status in ('auto-rejected', 'infeasible', 'completed')
                or (issue_record.author_uid = actor_uid and issue_record.status = 'review-rejected')
            end
          else
            case
              when actor_is_admin or issue_record.category = any(private_to_owner_categories)
                then issue_record.status in ('under-review', 'pending', 'processing')
              else issue_record.status in ('pending', 'processing')
                or (issue_record.author_uid = actor_uid and issue_record.status = 'under-review')
            end
        end
      )
      and (
        action_name <> 'searchIssues'
        or issue_record.title_search ilike (
          '%' || replace(replace(replace(lower(coalesce(title_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        ) escape '\'
      )
      and (
        cursor_id is null
        or case
          when effective_sort_name = 'most-supported' and cursor_sort_number is not null then
            issue_record.support_count < cursor_sort_number
            or (
              issue_record.support_count = cursor_sort_number
              and app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                < coalesce(cursor_sort_date, cursor_created_at)
            )
            or (
              issue_record.support_count = cursor_sort_number
              and app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                = coalesce(cursor_sort_date, cursor_created_at)
              and issue_record.id < cursor_id
            )
          when effective_sort_name = 'ending-soon' and cursor_sort_date is not null then
            issue_record.support_deadline_at > cursor_sort_date
            or (
              issue_record.support_deadline_at = cursor_sort_date
              and issue_record.created_at < cursor_created_at
            )
            or (
              issue_record.support_deadline_at = cursor_sort_date
              and issue_record.created_at = cursor_created_at
              and issue_record.id < cursor_id
            )
          when effective_sort_name = 'ending-soon' and cursor_sort_date is null then
            issue_record.support_deadline_at is null
            and (
              issue_record.created_at < cursor_created_at
              or (issue_record.created_at = cursor_created_at and issue_record.id < cursor_id)
            )
          else
            app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
              < coalesce(cursor_sort_date, cursor_created_at)
            or (
              app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                = coalesce(cursor_sort_date, cursor_created_at)
              and issue_record.id < cursor_id
            )
        end
      )
    order by
      case when effective_sort_name = 'most-supported' then issue_record.support_count end desc,
      case when effective_sort_name = 'ending-soon' then issue_record.support_deadline_at end asc nulls last,
      case when effective_sort_name = 'ending-soon' then issue_record.created_at end desc,
      case when effective_sort_name <> 'ending-soon'
        then app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
      end desc,
      issue_record.id desc
    limit limited_page_size + 1
  loop
    rows_json := rows_json || jsonb_build_array(app_api.backend_issue_list_to_json(
      page_row.issue_record,
      actor_uid,
      actor_is_admin,
      page_row.current_user_supported,
      private_to_owner_categories,
      review_required_categories,
      author_private_categories
    ));
  end loop;

  last_issue := rows_json -> (limited_page_size - 1);
  return jsonb_build_object(
    'issues', (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select value
        from jsonb_array_elements(rows_json) with ordinality as items(value, position)
        where position <= limited_page_size
        order by position
      ) limited_rows
    ),
    'hasMore', jsonb_array_length(rows_json) > limited_page_size,
    'limited', jsonb_array_length(rows_json) > limited_page_size,
    'cursor', case
      when jsonb_array_length(rows_json) > limited_page_size and last_issue is not null then
        jsonb_build_object(
          'id', last_issue ->> 'id',
          'created_at', last_issue -> 'created_at_ms',
          'sort_date', case
            when effective_sort_name = 'ending-soon' then last_issue -> 'support_deadline_at_ms'
            when coalesce(status_bucket, 'active') = 'closed'
              then coalesce(last_issue -> 'closed_at_ms', last_issue -> 'created_at_ms')
            else coalesce(last_issue -> 'review_approved_at_ms', last_issue -> 'created_at_ms')
          end,
          'sort_number', case
            when effective_sort_name = 'most-supported' then last_issue -> 'support_count'
            else null
          end
        )
      else null
    end
  );
end;
$$;


--
-- Name: backend_list_issues_snapshot("text", "text", boolean, "text", "text", "text", integer, "text", "uuid", timestamp with time zone, timestamp with time zone, integer); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_issues_snapshot"("action_name" "text", "actor_uid" "text", "actor_can_manage" boolean, "active_filter" "text", "status_bucket" "text", "sort_name" "text", "page_size" integer, "title_query" "text", "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "cursor_sort_date" timestamp with time zone, "cursor_sort_number" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  private_to_owner_categories text[];
  review_required_categories text[];
  author_private_categories text[];
  result jsonb;
  content_version bigint;
begin
  if not exists (
    select 1 from app_private.issue_categories category
    where category.id = active_filter and category.is_active
  ) then
    raise exception 'invalid-issue-category';
  end if;

  select
    coalesce(array_agg(id) filter (where read_access = 'owner-admin'), array[]::text[]),
    coalesce(array_agg(id) filter (where read_access = 'reviewed-school'), array[]::text[]),
    coalesce(array_agg(id) filter (where not author_visible), array[]::text[])
  into private_to_owner_categories, review_required_categories, author_private_categories
  from app_private.issue_categories;

  result := app_api.backend_list_issues(
    action_name, actor_uid, actor_can_manage, active_filter, status_bucket,
    sort_name, page_size, title_query, cursor_id, cursor_created_at,
    cursor_sort_date, cursor_sort_number, private_to_owner_categories,
    review_required_categories, author_private_categories
  );
  select version into content_version from app_private.content_versions where domain = 'issues';
  return coalesce(result, '{}'::jsonb) || jsonb_build_object('version', coalesce(content_version, 1));
end;
$$;


--
-- Name: backend_list_notifications("text", boolean, "text", integer, "uuid", timestamp with time zone); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_notifications"("actor_uid" "text", "actor_is_admin" boolean, "notification_source" "text", "page_size" integer, "cursor_id" "uuid", "cursor_created_at" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  limited_page_size integer := least(greatest(coalesce(page_size, 30), 1), 30);
  opened_at timestamptz;
  rows_json jsonb := '[]'::jsonb;
  last_notification jsonb;
  notification_record app_private.notifications%rowtype;
begin
  if backend_list_notifications.notification_source = 'admin'
    and not backend_list_notifications.actor_is_admin
  then
    return jsonb_build_object('notifications', '[]'::jsonb, 'cursor', null, 'hasMore', false);
  end if;

  select case
    when backend_list_notifications.notification_source = 'admin' then state_record.admin_opened_at
    when backend_list_notifications.notification_source = 'user' then state_record.user_opened_at
    else state_record.broadcast_opened_at
  end
  into opened_at
  from app_private.notification_states state_record
  where state_record.uid = backend_list_notifications.actor_uid;

  for notification_record in
    select notification.*
    from app_private.notifications notification
    where notification.source = backend_list_notifications.notification_source
      and (
        backend_list_notifications.notification_source <> 'user'
        or notification.recipient_uid = backend_list_notifications.actor_uid
      )
      and (
        backend_list_notifications.cursor_id is null
        or notification.created_at < backend_list_notifications.cursor_created_at
        or (
          notification.created_at = backend_list_notifications.cursor_created_at
          and notification.id < backend_list_notifications.cursor_id
        )
      )
    order by notification.created_at desc, notification.id desc
    limit limited_page_size + 1
  loop
    rows_json := rows_json || jsonb_build_array(
      app_api.backend_notification_to_json(notification_record, opened_at)
    );
  end loop;

  last_notification := rows_json -> (limited_page_size - 1);

  return jsonb_build_object(
    'notifications', (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select value
        from jsonb_array_elements(rows_json) with ordinality as items(value, position)
        where position <= limited_page_size
        order by position
      ) limited_rows
    ),
    'hasMore', jsonb_array_length(rows_json) > limited_page_size,
    'cursor', case
      when jsonb_array_length(rows_json) > limited_page_size and last_notification is not null then
        jsonb_build_object(
          'id', last_notification ->> 'id',
          'createdAtMs', last_notification -> 'created_at_ms'
        )
      else null
    end
  );
end;
$$;


--
-- Name: backend_list_user_issues("text", boolean, "text", integer, "uuid", timestamp with time zone, timestamp with time zone, integer, "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_user_issues"("actor_uid" "text", "actor_is_admin" boolean, "sort_name" "text", "page_size" integer, "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "cursor_sort_date" timestamp with time zone, "cursor_sort_number" integer, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "author_private_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  limited_page_size integer := least(greatest(coalesce(page_size, 20), 1), 50);
  query_limit integer := least(greatest(coalesce(page_size, 20), 1), 50) + 1;
  rows_json jsonb := '[]'::jsonb;
  last_issue jsonb;
  issue_record app_private.issues%rowtype;
begin
  for issue_record in
    select *
    from app_private.issues
    where author_uid = backend_list_user_issues.actor_uid
      and (
        cursor_id is null
        or case
          when sort_name = 'most-supported' and cursor_sort_number is not null then
            support_count < cursor_sort_number
            or (support_count = cursor_sort_number and coalesce(review_approved_at, created_at) < coalesce(cursor_sort_date, cursor_created_at))
            or (support_count = cursor_sort_number and coalesce(review_approved_at, created_at) = coalesce(cursor_sort_date, cursor_created_at) and id < cursor_id)
          when sort_name = 'ending-soon' and cursor_sort_date is not null then
            support_deadline_at > cursor_sort_date
            or (support_deadline_at = cursor_sort_date and created_at < cursor_created_at)
            or (support_deadline_at = cursor_sort_date and created_at = cursor_created_at and id < cursor_id)
          when sort_name = 'ending-soon' and cursor_sort_date is null then
            support_deadline_at is null
            and (created_at < cursor_created_at or (created_at = cursor_created_at and id < cursor_id))
          else
            coalesce(review_approved_at, created_at) < coalesce(cursor_sort_date, cursor_created_at)
            or (coalesce(review_approved_at, created_at) = coalesce(cursor_sort_date, cursor_created_at) and id < cursor_id)
        end
      )
    order by
      case when sort_name = 'most-supported' then support_count end desc,
      case when sort_name = 'ending-soon' then support_deadline_at end asc nulls last,
      case when sort_name = 'ending-soon' then created_at end desc,
      case when sort_name <> 'ending-soon' then coalesce(review_approved_at, created_at) end desc,
      id desc
    limit query_limit
  loop
    rows_json := rows_json || jsonb_build_array(app_api.backend_issue_to_json(
      issue_record,
      actor_uid,
      actor_is_admin,
      private_to_owner_categories,
      review_required_categories,
      author_private_categories
    ));
  end loop;

  last_issue := rows_json -> (limited_page_size - 1);
  return jsonb_build_object(
    'issues', (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select value
        from jsonb_array_elements(rows_json) with ordinality as items(value, position)
        where position <= limited_page_size
        order by position
      ) limited_rows
    ),
    'hasMore', jsonb_array_length(rows_json) > limited_page_size,
    'cursor', case
      when jsonb_array_length(rows_json) > limited_page_size and last_issue is not null then
        jsonb_build_object(
          'id', last_issue ->> 'id',
          'created_at', last_issue -> 'created_at_ms',
          'sort_date', case
            when sort_name = 'ending-soon' then last_issue -> 'support_deadline_at_ms'
            else coalesce(last_issue -> 'review_approved_at_ms', last_issue -> 'created_at_ms')
          end,
          'sort_number', case when sort_name = 'most-supported' then last_issue -> 'support_count' else null end
        )
      else null
    end
  );
end;
$$;


--
-- Name: backend_list_user_issues("text", boolean, "text", "text", integer, "uuid", timestamp with time zone, timestamp with time zone, integer, "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_user_issues"("actor_uid" "text", "actor_is_admin" boolean, "status_bucket" "text", "sort_name" "text", "page_size" integer, "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "cursor_sort_date" timestamp with time zone, "cursor_sort_number" integer, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "author_private_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  effective_sort_name text := case
    when coalesce(status_bucket, 'active') = 'closed' then 'latest'
    else coalesce(sort_name, 'latest')
  end;
  limited_page_size integer := least(greatest(coalesce(page_size, 30), 1), 50);
  rows_json jsonb := '[]'::jsonb;
  supported_issue_ids uuid[] := '{}'::uuid[];
  last_issue jsonb;
  issue_record app_private.issues%rowtype;
begin
  select coalesce(array_agg(issue_id), '{}'::uuid[])
  into supported_issue_ids
  from app_private.supports
  where uid = actor_uid;

  for issue_record in
    select *
    from app_private.issues
    where author_uid = backend_list_user_issues.actor_uid
      and case
        when coalesce(status_bucket, 'active') = 'closed'
          then status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed')
        else status in ('under-review', 'pending', 'processing')
      end
      and (
        cursor_id is null
        or case
          when effective_sort_name = 'most-supported' and cursor_sort_number is not null then
            support_count < cursor_sort_number
            or (
              support_count = cursor_sort_number
              and app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                < coalesce(cursor_sort_date, cursor_created_at)
            )
            or (
              support_count = cursor_sort_number
              and app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                = coalesce(cursor_sort_date, cursor_created_at)
              and id < cursor_id
            )
          when effective_sort_name = 'ending-soon' and cursor_sort_date is not null then
            support_deadline_at > cursor_sort_date
            or (support_deadline_at = cursor_sort_date and created_at < cursor_created_at)
            or (support_deadline_at = cursor_sort_date and created_at = cursor_created_at and id < cursor_id)
          when effective_sort_name = 'ending-soon' and cursor_sort_date is null then
            support_deadline_at is null
            and (created_at < cursor_created_at or (created_at = cursor_created_at and id < cursor_id))
          else
            app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
              < coalesce(cursor_sort_date, cursor_created_at)
            or (
              app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
                = coalesce(cursor_sort_date, cursor_created_at)
              and id < cursor_id
            )
        end
      )
    order by
      case when effective_sort_name = 'most-supported' then support_count end desc,
      case when effective_sort_name = 'ending-soon' then support_deadline_at end asc nulls last,
      case when effective_sort_name = 'ending-soon' then created_at end desc,
      case when effective_sort_name <> 'ending-soon'
        then app_private.issue_list_sort_date(issue_record, status_bucket, effective_sort_name)
      end desc,
      id desc
    limit limited_page_size + 1
  loop
    rows_json := rows_json || jsonb_build_array(app_api.backend_issue_list_to_json(
      issue_record,
      actor_uid,
      actor_is_admin,
      issue_record.id = any(supported_issue_ids),
      private_to_owner_categories,
      review_required_categories,
      author_private_categories
    ));
  end loop;

  last_issue := rows_json -> (limited_page_size - 1);

  return jsonb_build_object(
    'issues', (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select value
        from jsonb_array_elements(rows_json) with ordinality as items(value, position)
        where position <= limited_page_size
        order by position
      ) limited_rows
    ),
    'hasMore', jsonb_array_length(rows_json) > limited_page_size,
    'cursor', case
      when jsonb_array_length(rows_json) > limited_page_size and last_issue is not null then
        jsonb_build_object(
          'id', last_issue ->> 'id',
          'created_at', last_issue -> 'created_at_ms',
          'sort_date', case
            when effective_sort_name = 'ending-soon' then last_issue -> 'support_deadline_at_ms'
            when coalesce(status_bucket, 'active') = 'closed'
              then coalesce(last_issue -> 'closed_at_ms', last_issue -> 'created_at_ms')
            else coalesce(last_issue -> 'review_approved_at_ms', last_issue -> 'created_at_ms')
          end,
          'sort_number', case
            when effective_sort_name = 'most-supported' then last_issue -> 'support_count'
            else null
          end
        )
      else null
    end
  );
end;
$$;


--
-- Name: backend_list_user_issues_snapshot("text", boolean, "text", "text", integer, "uuid", timestamp with time zone, timestamp with time zone, integer); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_list_user_issues_snapshot"("actor_uid" "text", "actor_is_admin" boolean, "status_bucket" "text", "sort_name" "text", "page_size" integer, "cursor_id" "uuid", "cursor_created_at" timestamp with time zone, "cursor_sort_date" timestamp with time zone, "cursor_sort_number" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  private_to_owner_categories text[];
  review_required_categories text[];
  author_private_categories text[];
  result jsonb;
  content_version bigint;
begin
  select
    coalesce(array_agg(id) filter (where read_access = 'owner-admin'), array[]::text[]),
    coalesce(array_agg(id) filter (where read_access = 'reviewed-school'), array[]::text[]),
    coalesce(array_agg(id) filter (where not author_visible), array[]::text[])
  into private_to_owner_categories, review_required_categories, author_private_categories
  from app_private.issue_categories;

  result := app_api.backend_list_user_issues(
    actor_uid, actor_is_admin, status_bucket, sort_name, page_size, cursor_id,
    cursor_created_at, cursor_sort_date, cursor_sort_number,
    private_to_owner_categories, review_required_categories, author_private_categories
  );
  select version into content_version from app_private.content_versions where domain = 'issues';
  return coalesce(result, '{}'::jsonb) || jsonb_build_object('version', coalesce(content_version, 1));
end;
$$;


--
-- Name: backend_mark_notifications_opened("text", timestamp with time zone); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_mark_notifications_opened"("actor_uid" "text", "opened_at" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
begin
  insert into app_private.notification_states(uid, admin_opened_at, broadcast_opened_at, user_opened_at, updated_at)
  values (
    backend_mark_notifications_opened.actor_uid,
    backend_mark_notifications_opened.opened_at,
    backend_mark_notifications_opened.opened_at,
    backend_mark_notifications_opened.opened_at,
    backend_mark_notifications_opened.opened_at
  )
  on conflict (uid) do update
  set admin_opened_at = excluded.admin_opened_at,
      broadcast_opened_at = excluded.broadcast_opened_at,
      user_opened_at = excluded.user_opened_at,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'success', true,
    'openedAtMs', floor(extract(epoch from backend_mark_notifications_opened.opened_at) * 1000)
  );
end;
$$;


--
-- Name: backend_moderate_issue_status("uuid", "text", boolean, "text", "text", timestamp with time zone, timestamp with time zone, timestamp with time zone, "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_moderate_issue_status"("issue_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean, "next_status" "text", "review_rejection_reason" "text", "review_approved_at" timestamp with time zone, "support_deadline_at" timestamp with time zone, "response_deadline_at" timestamp with time zone, "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "author_private_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  issue_record app_private.issues%rowtype;
begin
  if not actor_is_admin then
    raise exception 'permission-denied';
  end if;

  update app_private.issues
  set last_actor_uid = backend_moderate_issue_status.actor_uid,
      review_rejection_reason = backend_moderate_issue_status.review_rejection_reason,
      status = backend_moderate_issue_status.next_status,
      review_approved_at = backend_moderate_issue_status.review_approved_at,
      support_deadline_at = backend_moderate_issue_status.support_deadline_at,
      response_deadline_at = coalesce(backend_moderate_issue_status.response_deadline_at, app_private.issues.response_deadline_at)
  where id = backend_moderate_issue_status.issue_id
  returning * into issue_record;

  if not found then
    raise exception 'not-found';
  end if;

  return app_api.backend_issue_to_json(
    issue_record,
    actor_uid,
    actor_is_admin,
    private_to_owner_categories,
    review_required_categories,
    author_private_categories
  );
end;
$$;


--
-- Name: notification_states; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."notification_states" (
    "uid" "text" NOT NULL,
    "broadcast_opened_at" timestamp with time zone,
    "admin_opened_at" timestamp with time zone,
    "user_opened_at" timestamp with time zone,
    "push_comments_enabled" boolean DEFAULT true NOT NULL,
    "push_issue_updates_enabled" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "push_facility_updates_enabled" boolean DEFAULT true NOT NULL
);


--
-- Name: backend_notification_state_to_json("app_private"."notification_states"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_notification_state_to_json"("state_record" "app_private"."notification_states") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
  select jsonb_build_object(
    'uid',state_record.uid,
    'broadcast_opened_at_ms',case when state_record.broadcast_opened_at is null then null else floor(extract(epoch from state_record.broadcast_opened_at)*1000) end,
    'admin_opened_at_ms',case when state_record.admin_opened_at is null then null else floor(extract(epoch from state_record.admin_opened_at)*1000) end,
    'user_opened_at_ms',case when state_record.user_opened_at is null then null else floor(extract(epoch from state_record.user_opened_at)*1000) end,
    'push_comments_enabled',state_record.push_comments_enabled,
    'push_issue_updates_enabled',state_record.push_issue_updates_enabled,
    'push_facility_updates_enabled',state_record.push_facility_updates_enabled,
    'updated_at',state_record.updated_at
  );
$$;


--
-- Name: notifications; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "recipient_uid" "text",
    "type" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "actor_uid" "text",
    "body_preview" "text",
    "issue_category" "text",
    "old_status" "text",
    "new_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "comment_id" "uuid",
    CONSTRAINT "notifications_source_check" CHECK (("source" = ANY (ARRAY['broadcast'::"text", 'admin'::"text", 'user'::"text"]))),
    CONSTRAINT "notifications_target_type_check" CHECK (("target_type" = ANY (ARRAY['announcement'::"text", 'issue'::"text", 'facility'::"text"])))
);


--
-- Name: backend_notification_to_json("app_private"."notifications", timestamp with time zone); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_notification_to_json"("notification_record" "app_private"."notifications", "opened_at" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
  select to_jsonb(notification_record)
    || jsonb_build_object(
      'created_at_ms', floor(extract(epoch from notification_record.created_at) * 1000),
      'is_read', case when opened_at is null then false else notification_record.created_at <= opened_at end
    );
$$;


--
-- Name: backend_push_notification_preference("text", "text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_push_notification_preference"("actor_uid" "text", "device_id" "text", "permission" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare state_record app_private.notification_states%rowtype; token_count integer; device_enabled boolean:=false;
begin
  state_record:=app_api.backend_upsert_notification_state(actor_uid);
  if coalesce(device_id,'')<>'' then select exists(select 1 from app_private.push_tokens where uid=actor_uid and push_tokens.device_id=backend_push_notification_preference.device_id) into device_enabled; end if;
  select count(*) into token_count from app_private.push_tokens where uid=actor_uid;
  return jsonb_build_object('deviceEnabled',device_enabled,'enabled',token_count>0,'personalPreferences',jsonb_build_object(
    'comments',state_record.push_comments_enabled<>false,'issueUpdates',state_record.push_issue_updates_enabled<>false,
    'facilityUpdates',state_record.push_facility_updates_enabled<>false),
    'permission',coalesce(permission,'default'),'tokenCount',token_count);
end;
$$;


--
-- Name: backend_reconcile_platform_admins("text", "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_reconcile_platform_admins"("actor_uid" "text", "admin_emails" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  emails text[] := coalesce((
    select array_agg(distinct lower(btrim(value)) order by lower(btrim(value)))
    from unnest(admin_emails) value where btrim(value) <> ''
  ), array[]::text[]);
  granted_count integer;
  revoked_count integer;
begin
  if coalesce(btrim(actor_uid), '') = '' or cardinality(emails) = 0 then
    raise exception 'validation-required';
  end if;

  lock table app_private.user_role_assignments in share row exclusive mode;

  with revoked as (
    delete from app_private.user_role_assignments assignment
    where assignment.role_code = 'platform-admin'
      and not exists (
        select 1 from app_private.user_profiles profile
        where profile.uid = assignment.uid and lower(profile.email) = any(emails)
      )
    returning assignment.uid
  ), audited as (
    insert into app_private.role_assignment_audit(uid, role_code, operation, actor_uid)
    select uid, 'platform-admin', 'revoke', backend_reconcile_platform_admins.actor_uid from revoked
    returning uid
  )
  select count(*) into revoked_count from audited;

  with granted as (
    insert into app_private.user_role_assignments(uid, role_code, granted_by)
    select profile.uid, 'platform-admin', backend_reconcile_platform_admins.actor_uid
    from app_private.user_profiles profile
    where lower(profile.email) = any(emails)
    on conflict (uid, role_code) do nothing
    returning uid
  ), audited as (
    insert into app_private.role_assignment_audit(uid, role_code, operation, actor_uid)
    select uid, 'platform-admin', 'grant', backend_reconcile_platform_admins.actor_uid from granted
    returning uid
  )
  select count(*) into granted_count from audited;

  return jsonb_build_object('success', true, 'granted', granted_count, 'revoked', revoked_count);
end;
$$;


--
-- Name: backend_register_push_token("text", "text", "text", "text", "text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_register_push_token"("actor_uid" "text", "device_id" "text", "token" "text", "permission" "text", "platform" "text", "user_agent" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  max_devices constant integer := 10;
begin
  perform pg_advisory_xact_lock(hashtextextended(backend_register_push_token.actor_uid, 0));
  if not exists (
    select 1
    from app_private.push_tokens
    where push_tokens.uid = backend_register_push_token.actor_uid
      and push_tokens.device_id = backend_register_push_token.device_id
  ) and (
    select count(*)
    from app_private.push_tokens
    where push_tokens.uid = backend_register_push_token.actor_uid
  ) >= max_devices then
    raise exception 'push-token-limit-reached';
  end if;

  insert into app_private.push_tokens(uid, device_id, token, permission, platform, user_agent, updated_at)
  values (
    backend_register_push_token.actor_uid,
    backend_register_push_token.device_id,
    backend_register_push_token.token,
    coalesce(backend_register_push_token.permission, 'default'),
    backend_register_push_token.platform,
    backend_register_push_token.user_agent,
    now()
  )
  on conflict on constraint push_tokens_pkey do update
  set token = excluded.token,
      permission = excluded.permission,
      platform = excluded.platform,
      user_agent = excluded.user_agent,
      updated_at = excluded.updated_at;

  return app_api.backend_push_notification_preference(
    backend_register_push_token.actor_uid,
    backend_register_push_token.device_id,
    backend_register_push_token.permission
  );
end;
$$;


--
-- Name: backend_save_category_management("text", "jsonb", "jsonb", "text"[], "text"[], boolean, boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_save_category_management"("actor_uid" "text", "issue_categories" "jsonb", "facility_categories" "jsonb", "deleted_issue_category_ids" "text"[], "deleted_facility_category_ids" "text"[], "issues_enabled" boolean, "facilities_enabled" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  category jsonb;
  before_value jsonb;
  deleted_id text;
  existing_issue app_private.issue_categories%rowtype;
  existing_facility app_private.facility_categories%rowtype;
  saved_value jsonb;
begin
  if jsonb_typeof(issue_categories) <> 'array'
    or jsonb_typeof(facility_categories) <> 'array'
    or deleted_issue_category_ids is null
    or deleted_facility_category_ids is null
    or (issues_enabled and jsonb_array_length(issue_categories) = 0)
    or (facilities_enabled and jsonb_array_length(facility_categories) = 0)
    or exists (
      select 1 from jsonb_array_elements(issue_categories) kept
      where kept->>'id' = any(deleted_issue_category_ids)
    )
    or exists (
      select 1 from jsonb_array_elements(facility_categories) kept
      where kept->>'id' = any(deleted_facility_category_ids)
    ) then
    raise exception 'validation-required';
  end if;

  perform 1 from app_private.system_setup where singleton for update;
  perform 1 from app_private.issue_categories for update;
  perform 1 from app_private.facility_categories for update;

  foreach deleted_id in array deleted_issue_category_ids loop
    perform app_api.backend_delete_issue_category(deleted_id, actor_uid);
  end loop;
  foreach deleted_id in array deleted_facility_category_ids loop
    perform app_api.backend_delete_facility_category(deleted_id, actor_uid);
  end loop;

  update app_private.issue_categories set is_default = false where is_default;
  for category in select value from jsonb_array_elements(issue_categories)
  loop
    select * into existing_issue from app_private.issue_categories where id = category->>'id';
    before_value := case when found then to_jsonb(existing_issue) else null end;
    if before_value is not null and (
      existing_issue.read_access <> category->>'readAccess'
      or existing_issue.author_visible <> (category->>'authorVisible')::boolean
    ) then
      raise exception 'immutable-category-policy';
    end if;

    insert into app_private.issue_categories as saved(
      id,label,read_access,author_visible,support_enabled,support_goal,
      support_deadline_days,response_deadline_days,comments_enabled,is_active,
      is_default,sort_order,created_by,updated_at
    ) values(
      category->>'id',btrim(category->>'label'),category->>'readAccess',
      (category->>'authorVisible')::boolean,(category->>'supportEnabled')::boolean,
      nullif(category->>'supportGoal','')::integer,
      nullif(category->>'supportDeadlineDays','')::integer,
      nullif(category->>'responseDeadlineDays','')::integer,
      (category->>'commentsEnabled')::boolean,true,
      (category->>'isDefault')::boolean,(category->>'sortOrder')::integer,
      coalesce(existing_issue.created_by,actor_uid),now()
    ) on conflict(id) do update set
      label=excluded.label,support_enabled=excluded.support_enabled,
      support_goal=excluded.support_goal,support_deadline_days=excluded.support_deadline_days,
      response_deadline_days=excluded.response_deadline_days,
      comments_enabled=excluded.comments_enabled,is_active=true,
      is_default=excluded.is_default,sort_order=excluded.sort_order,updated_at=now()
    returning to_jsonb(saved) into saved_value;

    insert into app_private.category_configuration_audit(
      actor_uid,category_id,domain,operation,before_value,after_value
    ) values(
      actor_uid,category->>'id','issue',case when before_value is null then 'create' else 'update' end,
      before_value,saved_value
    );
  end loop;

  update app_private.facility_categories set is_default = false where is_default;
  for category in select value from jsonb_array_elements(facility_categories)
  loop
    select * into existing_facility from app_private.facility_categories where id = category->>'id';
    before_value := case when found then to_jsonb(existing_facility) else null end;

    insert into app_private.facility_categories as saved(
      id,label,is_active,is_default,sort_order,created_by,updated_at
    ) values(
      category->>'id',btrim(category->>'label'),true,
      (category->>'isDefault')::boolean,(category->>'sortOrder')::integer,
      coalesce(existing_facility.created_by,actor_uid),now()
    ) on conflict(id) do update set
      label=excluded.label,is_active=true,is_default=excluded.is_default,
      sort_order=excluded.sort_order,updated_at=now()
    returning to_jsonb(saved) into saved_value;

    insert into app_private.category_configuration_audit(
      actor_uid,category_id,domain,operation,before_value,after_value
    ) values(
      actor_uid,category->>'id','facility',case when before_value is null then 'create' else 'update' end,
      before_value,saved_value
    );
  end loop;

  perform app_api.backend_update_platform_features(
    actor_uid,issues_enabled,facilities_enabled
  );
  return jsonb_build_object('success',true);
end;
$$;


--
-- Name: backend_save_category_management("text", "jsonb", "jsonb", "text"[], "text"[], boolean, boolean, boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_save_category_management"("actor_uid" "text", "issue_categories" "jsonb", "facility_categories" "jsonb", "deleted_issue_category_ids" "text"[], "deleted_facility_category_ids" "text"[], "issues_enabled" boolean, "facilities_enabled" boolean, "announcement_comments_enabled" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
begin
  perform app_api.backend_save_category_management(
    actor_uid,
    issue_categories,
    facility_categories,
    deleted_issue_category_ids,
    deleted_facility_category_ids,
    issues_enabled,
    facilities_enabled
  );
  perform app_private.update_announcement_comment_setting(
    actor_uid, announcement_comments_enabled
  );
  return jsonb_build_object('success', true);
end;
$$;


--
-- Name: backend_set_announcement_like("uuid", "text", boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_set_announcement_like"("announcement_id" "uuid", "actor_uid" "text", "liked" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  next_like_count integer;
begin
  if liked then
    insert into app_private.announcement_likes(announcement_id, uid)
    values (
      backend_set_announcement_like.announcement_id,
      backend_set_announcement_like.actor_uid
    )
    on conflict on constraint announcement_likes_pkey do nothing;
  else
    delete from app_private.announcement_likes
    where announcement_likes.announcement_id = backend_set_announcement_like.announcement_id
      and announcement_likes.uid = backend_set_announcement_like.actor_uid;
  end if;

  select announcements.like_count into next_like_count
  from app_private.announcements
  where announcements.id = backend_set_announcement_like.announcement_id;

  if not found then
    raise exception 'not-found';
  end if;

  return jsonb_build_object('liked', liked, 'like_count', coalesce(next_like_count, 0));
end;
$$;


--
-- Name: backend_toggle_facility_affected("uuid", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_toggle_facility_affected"("facility_id" "uuid", "actor_uid" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare facility app_private.facility_reports%rowtype; now_affected boolean;
begin
  select * into facility from app_private.facility_reports where id=facility_id for update;
  if not found then raise exception 'not-found'; end if;
  if facility.author_uid=actor_uid then raise exception 'facility-author-fixed'; end if;
  if facility.status in ('completed','unable-to-handle') then raise exception 'facility-closed'; end if;
  delete from app_private.facility_report_affected_users where facility_report_affected_users.facility_id=backend_toggle_facility_affected.facility_id and uid=actor_uid;
  if found then now_affected := false;
  else insert into app_private.facility_report_affected_users(facility_id,uid) values(backend_toggle_facility_affected.facility_id,actor_uid); now_affected := true; end if;
  update app_private.facility_reports set affected_count=affected_count+case when now_affected then 1 else -1 end,updated_at=now()
    where id=facility_id returning * into facility;
  return jsonb_build_object('affected',now_affected,'affected_count',facility.affected_count);
end;
$$;


--
-- Name: backend_toggle_support("uuid", "text", boolean, integer); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_toggle_support"("issue_id" "uuid", "actor_uid" "text", "remove_support" boolean, "response_deadline_days" integer) RETURNS TABLE("supported" boolean, "support_count" integer, "goal_met" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare issue_record app_private.issues%rowtype; existing boolean; next_count integer; reached_goal boolean := false;
begin
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then raise exception 'not-found'; end if;
  if issue_record.author_uid = actor_uid then raise exception 'support-not-available'; end if;
  if issue_record.status <> 'pending' or not issue_record.support_enabled or issue_record.support_met_at is not null
    or (issue_record.support_deadline_at is not null and issue_record.support_deadline_at <= now())
  then raise exception 'support-not-available'; end if;
  select exists(select 1 from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and uid = actor_uid) into existing;
  if remove_support or existing then
    delete from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and uid = actor_uid;
    supported := false;
  else
    insert into app_private.supports(issue_id, uid) values (backend_toggle_support.issue_id, actor_uid);
    supported := true;
  end if;
  select issues.support_count into next_count from app_private.issues where id = backend_toggle_support.issue_id;
  if supported and issue_record.support_goal is not null and next_count >= issue_record.support_goal then
    update app_private.issues set support_met_at = coalesce(support_met_at, now()),
      response_deadline_at = case
        when backend_toggle_support.response_deadline_days is null then null
        else now() + make_interval(days => backend_toggle_support.response_deadline_days)
      end
    where id = backend_toggle_support.issue_id and support_met_at is null;
    reached_goal := found;
  end if;
  if reached_goal then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values ('support.goal_met','issue',issue_id::text,actor_uid,jsonb_build_object(
      'author_uid',issue_record.author_uid,'issue_category',issue_record.category,
      'new_support_count',next_count,'support_goal',issue_record.support_goal,'title',issue_record.title));
  end if;
  support_count := next_count; goal_met := reached_goal; return next;
end;
$$;


--
-- Name: backend_unregister_push_token("text", "text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_unregister_push_token"("actor_uid" "text", "device_id" "text", "permission" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
begin
  if coalesce(backend_unregister_push_token.device_id, '') <> '' then
    delete from app_private.push_tokens
    where push_tokens.uid = backend_unregister_push_token.actor_uid
      and push_tokens.device_id = backend_unregister_push_token.device_id;
  end if;

  return app_api.backend_push_notification_preference(
    backend_unregister_push_token.actor_uid,
    backend_unregister_push_token.device_id,
    backend_unregister_push_token.permission
  );
end;
$$;


--
-- Name: backend_update_facility_status("uuid", "text", boolean, "text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_update_facility_status"("facility_id" "uuid", "actor_uid" "text", "actor_can_manage" boolean, "next_status" "text", "result_content" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare facility app_private.facility_reports%rowtype; old_status text;
begin
  if not actor_can_manage then raise exception 'permission-denied'; end if;
  select * into facility from app_private.facility_reports where id=facility_id for update;
  if not found then raise exception 'not-found'; end if;
  old_status := facility.status;
  if not ((old_status='pending' and next_status='processing') or (old_status='processing' and next_status in ('completed','unable-to-handle'))) then raise exception 'invalid-status'; end if;
  if next_status in ('completed','unable-to-handle') and coalesce(length(btrim(backend_update_facility_status.result_content)),0)=0 then raise exception 'missing-result'; end if;
  update app_private.facility_reports set
    status=next_status,
    result_content=case when next_status in ('completed','unable-to-handle') then backend_update_facility_status.result_content else null end,
    started_at=case when next_status='processing' then coalesce(started_at,now()) else started_at end,
    closed_at=case when next_status in ('completed','unable-to-handle') then now() else null end,
    last_actor_uid=actor_uid,
    updated_at=now()
  where id=facility_id returning * into facility;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('facility.status_changed','facility',facility.id::text,actor_uid,jsonb_build_object(
    'author_uid',facility.author_uid,'old_status',old_status,'new_status',next_status,'title',facility.title,
    'affected_count',facility.affected_count,'result_content',facility.result_content));
  return to_jsonb(facility) || jsonb_build_object(
    'isOwnFacility',facility.author_uid=actor_uid,
    'currentUserAffected',facility.author_uid=actor_uid or exists(
      select 1 from app_private.facility_report_affected_users affected
      where affected.facility_id=facility.id and affected.uid=actor_uid
    ),
    'canManageFacility',true
  );
end;
$$;


--
-- Name: backend_update_issue_result("uuid", "text", boolean, "text", "text"[], "text"[], "text"[]); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_update_issue_result"("issue_id" "uuid", "actor_uid" "text", "actor_is_admin" boolean, "result_content" "text", "private_to_owner_categories" "text"[], "review_required_categories" "text"[], "author_private_categories" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  issue_record app_private.issues%rowtype;
begin
  if not backend_update_issue_result.actor_is_admin then
    raise exception 'permission-denied';
  end if;

  update app_private.issues
  set last_actor_uid = backend_update_issue_result.actor_uid,
      result_content = backend_update_issue_result.result_content
  where id = backend_update_issue_result.issue_id
  returning * into issue_record;

  if not found then
    raise exception 'not-found';
  end if;

  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values (
    'issue.result_updated',
    'issue',
    issue_record.id::text,
    backend_update_issue_result.actor_uid,
    jsonb_build_object(
      'author_uid', issue_record.author_uid,
      'issue_category', issue_record.category,
      'result_content', issue_record.result_content,
      'support_count', issue_record.support_count,
      'support_goal', issue_record.support_goal,
      'title', issue_record.title
    )
  );

  return app_api.backend_issue_to_json(
    issue_record,
    backend_update_issue_result.actor_uid,
    backend_update_issue_result.actor_is_admin,
    backend_update_issue_result.private_to_owner_categories,
    backend_update_issue_result.review_required_categories,
    backend_update_issue_result.author_private_categories
  );
end;
$$;


--
-- Name: backend_update_platform_features("text", boolean, boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_update_platform_features"("actor_uid" "text", "issues_enabled" boolean, "facilities_enabled" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare previous_value jsonb;
begin
  select jsonb_build_object(
    'issuesEnabled', setup.issues_enabled,
    'facilitiesEnabled', setup.facilities_enabled
  ) into previous_value
  from app_private.system_setup setup where singleton for update;

  update app_private.system_setup set
    issues_enabled=backend_update_platform_features.issues_enabled,
    facilities_enabled=backend_update_platform_features.facilities_enabled,
    updated_at=now()
  where singleton;

  insert into app_private.category_configuration_audit(
    domain,operation,actor_uid,before_value,after_value
  ) values (
    'setup','update-features',actor_uid,previous_value,
    jsonb_build_object(
      'issuesEnabled',issues_enabled,
      'facilitiesEnabled',facilities_enabled
    )
  );

  return jsonb_build_object(
    'success',true,
    'issuesEnabled',issues_enabled,
    'facilitiesEnabled',facilities_enabled
  );
end;
$$;


--
-- Name: backend_update_platform_features("text", boolean, boolean, boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_update_platform_features"("actor_uid" "text", "issues_enabled" boolean, "facilities_enabled" boolean, "announcement_comments_enabled" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare result jsonb;
begin
  result := app_api.backend_update_platform_features(
    actor_uid, issues_enabled, facilities_enabled
  );
  perform app_private.update_announcement_comment_setting(
    actor_uid, announcement_comments_enabled
  );
  return result || jsonb_build_object(
    'announcementCommentsEnabled', announcement_comments_enabled
  );
end;
$$;


--
-- Name: backend_update_push_notification_preferences("text", boolean, boolean, "text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_update_push_notification_preferences"("actor_uid" "text", "comments_enabled" boolean, "issue_updates_enabled" boolean, "device_id" "text", "permission" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
begin
  insert into app_private.notification_states(uid, push_comments_enabled, push_issue_updates_enabled, updated_at)
  values (
    backend_update_push_notification_preferences.actor_uid,
    backend_update_push_notification_preferences.comments_enabled,
    backend_update_push_notification_preferences.issue_updates_enabled,
    now()
  )
  on conflict (uid) do update
  set push_comments_enabled = excluded.push_comments_enabled,
      push_issue_updates_enabled = excluded.push_issue_updates_enabled,
      updated_at = excluded.updated_at;

  return app_api.backend_push_notification_preference(
    backend_update_push_notification_preferences.actor_uid,
    backend_update_push_notification_preferences.device_id,
    backend_update_push_notification_preferences.permission
  );
end;
$$;


--
-- Name: backend_update_push_notification_preferences("text", boolean, boolean, boolean, "text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_update_push_notification_preferences"("actor_uid" "text", "comments_enabled" boolean, "issue_updates_enabled" boolean, "facility_updates_enabled" boolean, "device_id" "text", "permission" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
begin
  insert into app_private.notification_states(uid,push_comments_enabled,push_issue_updates_enabled,push_facility_updates_enabled,updated_at)
  values(actor_uid,comments_enabled,issue_updates_enabled,facility_updates_enabled,now())
  on conflict(uid) do update set push_comments_enabled=excluded.push_comments_enabled,
    push_issue_updates_enabled=excluded.push_issue_updates_enabled,push_facility_updates_enabled=excluded.push_facility_updates_enabled,updated_at=excluded.updated_at;
  return app_api.backend_push_notification_preference(actor_uid,device_id,permission);
end;
$$;


--
-- Name: backend_update_user_access_scope("text", "text", "text", "text", boolean); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_update_user_access_scope"("actor_uid" "text", "target_uid" "text", "scope_kind" "text", "category_id" "text", "grant_access" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  previous_roles text[];
  previous_issue_ids text[];
  previous_facility_ids text[];
  next_roles text[];
  next_issue_ids text[];
  next_facility_ids text[];
  before_value jsonb;
  after_value jsonb;
  changed boolean := false;
  changed_count integer := 0;
begin
  if coalesce(btrim(actor_uid), '') = '' or coalesce(btrim(target_uid), '') = ''
    or scope_kind not in ('announcement', 'issue', 'facility') or grant_access is null then
    raise exception 'validation-required';
  end if;
  if scope_kind in ('issue', 'facility') and coalesce(btrim(category_id), '') = '' then
    raise exception 'validation-required';
  end if;
  if scope_kind = 'announcement' and coalesce(btrim(category_id), '') <> '' then
    raise exception 'validation-invalid';
  end if;

  perform 1 from app_private.user_profiles profile
  where profile.uid = backend_update_user_access_scope.target_uid
  for update;
  if not found then raise exception 'not-found'; end if;

  select coalesce(array_agg(assignment.role_code order by assignment.role_code), array[]::text[])
    into previous_roles from app_private.user_role_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;
  select coalesce(array_agg(assignment.category_id order by assignment.category_id), array[]::text[])
    into previous_issue_ids from app_private.user_issue_category_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;
  select coalesce(array_agg(assignment.category_id order by assignment.category_id), array[]::text[])
    into previous_facility_ids from app_private.user_facility_category_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;

  if 'platform-admin' = any(previous_roles) then raise exception 'permission-denied'; end if;

  before_value := jsonb_build_object(
    'roles', to_jsonb(previous_roles),
    'managedIssueCategoryIds', to_jsonb(previous_issue_ids),
    'managedFacilityCategoryIds', to_jsonb(previous_facility_ids)
  );

  if scope_kind = 'announcement' then
    if grant_access then
      insert into app_private.user_role_assignments(uid, role_code, granted_by)
      values(backend_update_user_access_scope.target_uid, 'announcement-manager', backend_update_user_access_scope.actor_uid)
      on conflict (uid, role_code) do nothing;
    else
      delete from app_private.user_role_assignments
      where user_role_assignments.uid = backend_update_user_access_scope.target_uid
        and user_role_assignments.role_code = 'announcement-manager';
    end if;
    get diagnostics changed_count = row_count;
    changed := changed_count > 0;
    if changed then
      insert into app_private.role_assignment_audit(uid, role_code, operation, actor_uid)
      values(
        backend_update_user_access_scope.target_uid,
        'announcement-manager',
        case when grant_access then 'grant' else 'revoke' end,
        backend_update_user_access_scope.actor_uid
      );
    end if;
  elsif scope_kind = 'issue' then
    if not exists(select 1 from app_private.issue_categories category
      where category.id = backend_update_user_access_scope.category_id and category.is_active) then
      raise exception 'validation-invalid';
    end if;
    if grant_access then
      insert into app_private.user_issue_category_assignments(uid, category_id, granted_by)
      values(
        backend_update_user_access_scope.target_uid,
        backend_update_user_access_scope.category_id,
        backend_update_user_access_scope.actor_uid
      )
      on conflict on constraint user_issue_category_assignments_pkey do nothing;
    else
      delete from app_private.user_issue_category_assignments
      where user_issue_category_assignments.uid = backend_update_user_access_scope.target_uid
        and user_issue_category_assignments.category_id = backend_update_user_access_scope.category_id;
    end if;
    get diagnostics changed_count = row_count;
    changed := changed_count > 0;
  else
    if not exists(select 1 from app_private.facility_categories category
      where category.id = backend_update_user_access_scope.category_id and category.is_active) then
      raise exception 'validation-invalid';
    end if;
    if grant_access then
      insert into app_private.user_facility_category_assignments(uid, category_id, notify_on_created, granted_by)
      values(
        backend_update_user_access_scope.target_uid,
        backend_update_user_access_scope.category_id,
        true,
        backend_update_user_access_scope.actor_uid
      )
      on conflict on constraint user_facility_category_assignments_pkey do nothing;
    else
      delete from app_private.user_facility_category_assignments
      where user_facility_category_assignments.uid = backend_update_user_access_scope.target_uid
        and user_facility_category_assignments.category_id = backend_update_user_access_scope.category_id;
    end if;
    get diagnostics changed_count = row_count;
    changed := changed_count > 0;
  end if;

  select coalesce(array_agg(assignment.role_code order by assignment.role_code), array[]::text[])
    into next_roles from app_private.user_role_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;
  select coalesce(array_agg(assignment.category_id order by assignment.category_id), array[]::text[])
    into next_issue_ids from app_private.user_issue_category_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;
  select coalesce(array_agg(assignment.category_id order by assignment.category_id), array[]::text[])
    into next_facility_ids from app_private.user_facility_category_assignments assignment
    where assignment.uid = backend_update_user_access_scope.target_uid;

  after_value := jsonb_build_object(
    'roles', to_jsonb(next_roles),
    'managedIssueCategoryIds', to_jsonb(next_issue_ids),
    'managedFacilityCategoryIds', to_jsonb(next_facility_ids)
  );
  if changed then
    insert into app_private.access_assignment_audit(actor_uid, target_uid, before_value, after_value)
    values(
      backend_update_user_access_scope.actor_uid,
      backend_update_user_access_scope.target_uid,
      before_value,
      after_value
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'roles', to_jsonb(next_roles),
    'managedIssueCategoryIds', to_jsonb(next_issue_ids),
    'managedFacilityCategoryIds', to_jsonb(next_facility_ids)
  );
end;
$$;


--
-- Name: backend_upsert_notification_state("text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."backend_upsert_notification_state"("actor_uid" "text") RETURNS "app_private"."notification_states"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  state_record app_private.notification_states%rowtype;
begin
  insert into app_private.notification_states(uid)
  values (backend_upsert_notification_state.actor_uid)
  on conflict (uid) do update set uid = excluded.uid
  returning * into state_record;

  return state_record;
end;
$$;


--
-- Name: deletion_jobs; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."deletion_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "cloudinary_public_id" "text",
    "notion_page_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "error_trace_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    CONSTRAINT "deletion_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


--
-- Name: claim_deletion_jobs(integer); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."claim_deletion_jobs"("batch_size" integer DEFAULT 10) RETURNS SETOF "app_private"."deletion_jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  return query
  with claimed as (
    select id from app_private.deletion_jobs
    where attempt_count < 8
      and (
        (status in ('pending', 'failed') and next_attempt_at <= now())
        or (status = 'processing' and locked_at < now() - interval '10 minutes')
      )
    order by created_at asc
    limit greatest(1, least(batch_size, 10))
    for update skip locked
  )
  update app_private.deletion_jobs job
  set status = 'processing', attempt_count = job.attempt_count + 1,
      locked_at = now(), updated_at = now()
  from claimed where job.id = claimed.id returning job.*;
end;
$$;


--
-- Name: claim_idempotency_key("text", "text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."claim_idempotency_key"("actor_uid" "text", "action_name" "text", "request_id" "text") RETURNS TABLE("claimed" boolean, "completed" boolean, "response" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  existing app_private.idempotency_keys%rowtype;
  inserted_count integer := 0;
begin
  if length(btrim(coalesce(actor_uid,''))) = 0 or length(btrim(coalesce(action_name,''))) = 0
    or length(btrim(coalesce(request_id,''))) = 0 or length(request_id) > 120
  then raise exception 'validation-invalid'; end if;
  insert into app_private.idempotency_keys(uid,action,request_id)
  values(actor_uid,action_name,request_id) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  select * into existing from app_private.idempotency_keys
  where uid=actor_uid and action=action_name and idempotency_keys.request_id=claim_idempotency_key.request_id
  for update;
  if inserted_count = 1 then return query select true,false,null::jsonb; return; end if;
  if existing.status = 'completed' then return query select false,true,existing.response; return; end if;
  if existing.updated_at < now() - interval '10 minutes' then
    update app_private.idempotency_keys set updated_at=now(), expires_at=now()+interval '1 day'
    where uid=actor_uid and action=action_name and idempotency_keys.request_id=claim_idempotency_key.request_id;
    return query select true,false,null::jsonb; return;
  end if;
  return query select false,false,null::jsonb;
end;
$$;


--
-- Name: outbox_events; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."outbox_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "actor_uid" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    "error_trace_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '3 days'::interval) NOT NULL,
    "notification_completed_at" timestamp with time zone,
    "notion_completed_at" timestamp with time zone,
    CONSTRAINT "outbox_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


--
-- Name: claim_outbox_events(integer); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."claim_outbox_events"("batch_size" integer DEFAULT 25) RETURNS SETOF "app_private"."outbox_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  return query
  with claimed as (
    select id from app_private.outbox_events
    where attempt_count < 8
      and (
        (status in ('pending', 'failed') and next_attempt_at <= now())
        or (status = 'processing' and locked_at < now() - interval '10 minutes')
      )
    order by occurred_at asc
    limit greatest(1, least(batch_size, 25))
    for update skip locked
  )
  update app_private.outbox_events event
  set status = 'processing', attempt_count = event.attempt_count + 1,
      locked_at = now(), updated_at = now()
  from claimed where event.id = claimed.id returning event.*;
end;
$$;


--
-- Name: push_delivery_logs; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."push_delivery_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token_uid" "text",
    "notification_type" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "error_trace_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "delivery_key" "text",
    "notification" "jsonb",
    "recipient_uids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    CONSTRAINT "push_delivery_logs_attempt_count_check" CHECK (("attempt_count" >= 0)),
    CONSTRAINT "push_delivery_logs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'sent'::"text", 'failed'::"text"])))
);


--
-- Name: claim_push_delivery_jobs(integer); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."claim_push_delivery_jobs"("batch_size" integer DEFAULT 10) RETURNS SETOF "app_private"."push_delivery_logs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  return query
  with claimed as (
    select id
    from app_private.push_delivery_logs
    where notification is not null
      and attempt_count < 8
      and (
        (status in ('pending', 'failed') and next_attempt_at <= now())
        or (status = 'processing' and locked_at < now() - interval '10 minutes')
      )
    order by next_attempt_at, created_at
    limit greatest(1, least(batch_size, 25))
    for update skip locked
  )
  update app_private.push_delivery_logs job
  set status = 'processing',
      attempt_count = job.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  from claimed
  where job.id = claimed.id
  returning job.*;
end;
$$;


--
-- Name: realtime_events; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."realtime_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "topic" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "error_trace_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '2 days'::interval) NOT NULL,
    CONSTRAINT "realtime_events_attempt_count_check" CHECK (("attempt_count" >= 0)),
    CONSTRAINT "realtime_events_event_name_check" CHECK ((("length"("event_name") >= 1) AND ("length"("event_name") <= 120))),
    CONSTRAINT "realtime_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "realtime_events_topic_check" CHECK ((("length"("topic") >= 1) AND ("length"("topic") <= 240)))
);


--
-- Name: claim_realtime_events(integer); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."claim_realtime_events"("batch_size" integer DEFAULT 50) RETURNS SETOF "app_private"."realtime_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'pg_catalog'
    AS $$
begin
  return query
  with candidates as (
    select event.id
    from app_private.realtime_events event
    where event.attempt_count < 10
      and (
        (event.status in ('pending', 'failed') and event.next_attempt_at <= now())
        or (event.status = 'processing' and event.locked_at < now() - interval '5 minutes')
      )
    order by event.created_at
    for update skip locked
    limit greatest(1, least(coalesce(batch_size, 50), 100))
  )
  update app_private.realtime_events event
  set status = 'processing',
      attempt_count = event.attempt_count + 1,
      locked_at = now(),
      error_trace_id = null
  from candidates
  where event.id = candidates.id
  returning event.*;
end;
$$;


--
-- Name: complete_deletion_job("uuid"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."complete_deletion_job"("job_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  update app_private.deletion_jobs
  set
    status = 'completed',
    updated_at = now()
  where id = job_id;
$$;


--
-- Name: complete_idempotency_key("text", "text", "text", "jsonb"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."complete_idempotency_key"("actor_uid" "text", "action_name" "text", "request_id" "text", "action_response" "jsonb") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  update app_private.idempotency_keys
  set
    status = 'completed',
    response = action_response,
    updated_at = now(),
    expires_at = now() + interval '24 hours'
  where uid = actor_uid
    and action = action_name
    and idempotency_keys.request_id = complete_idempotency_key.request_id
    and status = 'processing';
$$;


--
-- Name: complete_outbox_event("uuid"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."complete_outbox_event"("event_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  update app_private.outbox_events
  set
    status = 'completed',
    updated_at = now(),
    expires_at = now() + interval '1 day'
  where id = event_id;
$$;


--
-- Name: complete_push_delivery_job("uuid"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."complete_push_delivery_job"("job_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  update app_private.push_delivery_logs
  set status = 'sent',
      notification = null,
      recipient_uids = '{}',
      locked_at = null,
      updated_at = now()
  where id = job_id and status = 'processing';
$$;


--
-- Name: complete_realtime_event("uuid"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."complete_realtime_event"("event_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'pg_catalog'
    AS $$
  update app_private.realtime_events
  set status = 'completed',
      completed_at = now(),
      locked_at = null,
      payload = '{}'::jsonb
  where id = event_id;
$$;


--
-- Name: fail_deletion_job("uuid", "uuid"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."fail_deletion_job"("job_id" "uuid", "error_trace_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  update app_private.deletion_jobs
  set
    status = 'failed',
    error_trace_id = fail_deletion_job.error_trace_id,
    next_attempt_at = now() + make_interval(mins => least(60, greatest(1, attempt_count * 2))),
    updated_at = now()
  where id = job_id;
$$;


--
-- Name: fail_outbox_event("uuid", "uuid"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."fail_outbox_event"("event_id" "uuid", "error_trace_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  update app_private.outbox_events
  set
    status = 'failed',
    error_trace_id = fail_outbox_event.error_trace_id,
    next_attempt_at = now() + make_interval(mins => least(60, greatest(1, attempt_count * 2))),
    updated_at = now(),
    expires_at = now() + interval '3 days'
  where id = event_id;
$$;


--
-- Name: fail_push_delivery_job("uuid", "uuid"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."fail_push_delivery_job"("job_id" "uuid", "trace_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  update app_private.push_delivery_logs
  set status = 'failed',
      error_trace_id = trace_id,
      next_attempt_at = now() + make_interval(
        secs => least(3600, (15 * power(2, greatest(0, attempt_count - 1)))::integer)
      ),
      locked_at = null,
      updated_at = now()
  where id = job_id and status = 'processing';
$$;


--
-- Name: fail_realtime_event("uuid", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."fail_realtime_event"("event_id" "uuid", "trace_id" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'pg_catalog'
    AS $$
  update app_private.realtime_events
  set status = 'failed',
      locked_at = null,
      error_trace_id = left(trace_id, 120),
      next_attempt_at = now() + make_interval(
        secs => least(300, greatest(2, power(2, least(attempt_count, 8))::integer))
      )
  where id = event_id;
$$;


--
-- Name: get_platform_dashboard_snapshot(); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."get_platform_dashboard_snapshot"() RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
with
counters as (
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) value from app_private.platform_counters
),
category_counters as (
  select
    coalesce(jsonb_object_agg(category, issues), '{}'::jsonb) issues,
    coalesce(jsonb_object_agg(category, comments), '{}'::jsonb) comments
  from app_private.platform_category_counters
),
activity as (
  select coalesce((select value::timestamptz from app_private.runtime_settings where key='last_activity_at'), 'epoch'::timestamptz) value
),
outbox_counts as (
  select
    count(*) filter (where status='failed')::bigint failed,
    count(*) filter (where status in ('pending','processing'))::bigint pending,
    count(*) filter (where status='failed' and notion_completed_at is null)::bigint notion_failed,
    count(*) filter (where status in ('pending','processing') and notion_completed_at is null)::bigint notion_pending,
    min(created_at) filter (where status in ('pending','processing') and notion_completed_at is null) oldest_notion
  from app_private.outbox_events
),
operation_counts as (
  select
    (select count(*) from app_private.push_delivery_logs where status='failed')::bigint push_failed,
    (select count(*) from app_private.uploads where status='pending')::bigint upload_pending,
    (select count(*) from app_private.deletion_jobs where status in ('pending','failed','processing'))::bigint deletion_pending,
    (select count(*) from app_private.deletion_jobs where status='failed')::bigint deletion_failed
),
maintenance as (
  select coalesce((select to_jsonb(row) from (
    select status, started_at, completed_at, error_trace_id, details
    from app_private.maintenance_runs where task_name='maintenance.cleanup'
    order by started_at desc limit 1
  ) row), '{}'::jsonb) value
),
recent_failures as (
  select coalesce(jsonb_agg(item order by updated_at desc), '[]'::jsonb) value from (
    select id::text, 'outbox'::text source, status, error_trace_id,
      event_type detail_type, target_type, target_id, attempt_count, next_attempt_at, created_at, updated_at
    from app_private.outbox_events where status='failed'
    union all
    select id::text, 'push'::text, status, error_trace_id, notification_type,
      target_type, target_id, null::integer, null::timestamptz, created_at, updated_at
    from app_private.push_delivery_logs where status='failed'
    union all
    select id::text, 'cleanup'::text, status, error_trace_id, target_type,
      target_type, target_id, attempt_count, next_attempt_at, created_at, updated_at
    from app_private.deletion_jobs where status='failed'
    order by updated_at desc limit 12
  ) item
)
select jsonb_build_object(
  'counters', counters.value,
  'issues_by_category', category_counters.issues,
  'comments_by_category', category_counters.comments,
  'last_activity_at', activity.value,
  'outbox_failed', outbox_counts.failed,
  'outbox_pending', outbox_counts.pending,
  'notion_failed', outbox_counts.notion_failed,
  'notion_pending', outbox_counts.notion_pending,
  'oldest_pending_notion_at', outbox_counts.oldest_notion,
  'push_failed', operation_counts.push_failed,
  'upload_pending', operation_counts.upload_pending,
  'deletion_pending', operation_counts.deletion_pending,
  'deletion_failed', operation_counts.deletion_failed,
  'maintenance', maintenance.value,
  'recent_failures', recent_failures.value,
  'users_seen', coalesce((counters.value->>'users_seen')::bigint, 0)
)
from counters, category_counters, activity, outbox_counts, operation_counts, maintenance, recent_failures;
$$;


--
-- Name: release_idempotency_key("text", "text", "text"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."release_idempotency_key"("actor_uid" "text", "action_name" "text", "request_id" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  delete from app_private.idempotency_keys
  where uid = actor_uid
    and action = action_name
    and idempotency_keys.request_id = release_idempotency_key.request_id
    and status = 'processing';
$$;


--
-- Name: run_maintenance_cleanup("text"[], "jsonb"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."run_maintenance_cleanup"("valid_issue_categories" "text"[] DEFAULT NULL::"text"[], "retention_config" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
  select app_private.run_maintenance_cleanup(valid_issue_categories, retention_config);
$$;


--
-- Name: run_scheduled_maintenance_cleanup("jsonb"); Type: FUNCTION; Schema: app_api; Owner: -
--

CREATE FUNCTION "app_api"."run_scheduled_maintenance_cleanup"("retention_config" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
declare
  result jsonb;
begin
  result := app_private.run_maintenance_cleanup(
    coalesce((
      select array_agg(category.id order by category.id)
      from app_private.issue_categories category
    ), array[]::text[]),
    coalesce(retention_config, '{}'::jsonb)
  );
  return jsonb_build_object(
    'result', result,
    'dueWorkers', jsonb_build_object(
      'outbox', exists (
        select 1 from app_private.outbox_events event
        where event.attempt_count < 8
          and (
            (event.status in ('pending', 'failed') and event.next_attempt_at <= now())
            or (event.status = 'processing' and event.locked_at < now() - interval '10 minutes')
          )
      ),
      'deletion', exists (
        select 1 from app_private.deletion_jobs job
        where job.attempt_count < 8
          and (
            (job.status in ('pending', 'failed') and job.next_attempt_at <= now())
            or (job.status = 'processing' and job.locked_at < now() - interval '10 minutes')
          )
      )
    )
  );
end;
$$;


--
-- Name: adjust_category_counter("text", bigint, bigint); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."adjust_category_counter"("category_name" "text", "issue_delta" bigint, "comment_delta" bigint) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  insert into app_private.platform_category_counters(category, issues, comments)
  values (category_name, greatest(issue_delta, 0), greatest(comment_delta, 0))
  on conflict(category) do update set
    issues = greatest(app_private.platform_category_counters.issues + issue_delta, 0),
    comments = greatest(app_private.platform_category_counters.comments + comment_delta, 0);
$$;


--
-- Name: apply_announcement_comment_setting(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."apply_announcement_comment_setting"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  update app_private.announcements
  set comments_enabled = new.announcement_comments_enabled
  where id is not null;
  return null;
end;
$$;


--
-- Name: attach_markdown_uploads_from_content(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."attach_markdown_uploads_from_content"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  upload_ids uuid[];
  removed_upload_ids uuid[];
  target_type_name text;
  valid_upload_count integer;
begin
  select coalesce(array_agg(distinct captures[1]::uuid), array[]::uuid[])
  into upload_ids
  from regexp_matches(coalesce(new.content, ''), 'srp-upload://([0-9a-fA-F-]{36})', 'g') as captures;
  target_type_name := case tg_table_name
    when 'issues' then 'issue' when 'comments' then 'comment'
    when 'announcements' then 'announcement' when 'announcement_comments' then 'announcement_comment'
    when 'facility_reports' then 'facility' else null end;
  if target_type_name is null then raise exception 'unsupported-upload-target'; end if;
  if cardinality(upload_ids) > 0 then
    select count(*) into valid_upload_count from app_private.uploads
    where id = any(upload_ids) and owner_uid = new.author_uid and status in ('ready', 'attached')
      and (attached_target_id is null or (attached_target_type = target_type_name and attached_target_id = new.id));
    if valid_upload_count <> cardinality(upload_ids) then raise exception 'upload-attachment-invalid'; end if;
    update app_private.uploads set attached_target_id = new.id, attached_target_type = target_type_name,
      status = 'attached', updated_at = now()
    where id = any(upload_ids) and owner_uid = new.author_uid;
  end if;
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(id), array[]::uuid[]) into removed_upload_ids
    from app_private.uploads where attached_target_type = target_type_name and attached_target_id = new.id
      and not (id = any(upload_ids));
    if cardinality(removed_upload_ids) > 0 then
      insert into app_private.deletion_jobs(target_type,target_id,cloudinary_public_id)
      select 'upload', id::text, cloudinary_public_id from app_private.uploads where id = any(removed_upload_ids);
      delete from app_private.uploads where id = any(removed_upload_ids);
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: broadcast_notification_insert(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."broadcast_notification_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'pg_catalog'
    AS $$
declare
  topic text;
begin
  topic := case new.source
    when 'broadcast' then 'notifications:broadcast'
    when 'admin' then 'notifications:admin'
    when 'user' then 'notifications:user:' || coalesce(new.recipient_uid, '')
    else null
  end;

  if topic is not null and topic not like '%:' then
    perform app_private.queue_realtime_event(
      topic,
      'notification_insert',
      to_jsonb(new)
    );
  end if;
  return null;
end;
$$;


--
-- Name: broadcast_notification_state_change(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."broadcast_notification_state_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'pg_catalog'
    AS $$
begin
  perform app_private.queue_realtime_event(
    'notification-state:' || new.uid,
    'notification_state_changed',
    to_jsonb(new)
  );
  return null;
end;
$$;


--
-- Name: bump_content_revision(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."bump_content_revision"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  insert into app_private.content_revisions(domain, revision, updated_at)
  values (tg_argv[0], 1, now())
  on conflict (domain) do update
  set revision = content_revisions.revision + 1,
      updated_at = excluded.updated_at;
  return null;
end;
$$;


--
-- Name: bump_content_version(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."bump_content_version"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  insert into app_private.content_versions(domain, version, updated_at)
  values (tg_argv[0], 2, now())
  on conflict (domain) do update
  set version = content_versions.version + 1,
      updated_at = excluded.updated_at;
  return null;
end;
$$;


--
-- Name: close_issue_comments_with_category(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."close_issue_comments_with_category"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  update app_private.issues issue
  set comments_enabled = (
    new.is_active
    and new.comments_enabled
    and issue.status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
  )
  where issue.category = new.id;
  return null;
end;
$$;


--
-- Name: emit_content_realtime_event("text", "text", "text", "text", "text", "text", "text", integer, integer, integer, "text"); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."emit_content_realtime_event"("event_type" "text", "target_type" "text", "target_id" "text", "parent_id" "text", "category" "text", "audience" "text", "recipient_uid" "text", "support_count" integer, "like_count" integer, "comment_count" integer, "op" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'pg_catalog'
    AS $$
declare
  event_payload jsonb;
  event_domain text := case
    when event_type like 'issue_%' then 'issues'
    when event_type like 'announcement_%' then 'announcements'
    when event_type = 'facility_changed' then 'facilities'
    else null
  end;
  event_version bigint;
begin
  select version into event_version
  from app_private.content_versions
  where domain = event_domain;

  event_payload := jsonb_build_object(
    'event_type', emit_content_realtime_event.event_type,
    'target_type', emit_content_realtime_event.target_type,
    'target_id', emit_content_realtime_event.target_id,
    'parent_id', emit_content_realtime_event.parent_id,
    'category', emit_content_realtime_event.category,
    'support_count', emit_content_realtime_event.support_count,
    'like_count', emit_content_realtime_event.like_count,
    'comment_count', emit_content_realtime_event.comment_count,
    'op', emit_content_realtime_event.op,
    'version', coalesce(event_version, 1),
    'created_at', now()
  );

  if emit_content_realtime_event.audience = 'school' then
    perform app_private.queue_realtime_event(
      'content:school',
      'content_changed',
      event_payload
    );
    return;
  end if;

  if coalesce(emit_content_realtime_event.recipient_uid, '') <> '' then
    perform app_private.queue_realtime_event(
      'content:user:' || emit_content_realtime_event.recipient_uid,
      'content_changed',
      event_payload
    );
  end if;

  perform app_private.queue_realtime_event(
    'content:admin',
    'content_changed',
    event_payload
  );
end;
$$;


--
-- Name: enforce_announcement_comment_availability(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."enforce_announcement_comment_availability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare global_comments_enabled boolean;
begin
  select setup.announcement_comments_enabled
  into global_comments_enabled
  from app_private.system_setup setup
  where setup.singleton;
  new.comments_enabled := coalesce(global_comments_enabled, false);
  return new;
end;
$$;


--
-- Name: enforce_entry_input_limits(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."enforce_entry_input_limits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  row_data jsonb := to_jsonb(new);
  title_value text := coalesce(row_data ->> 'title', '');
  content_value text := coalesce(row_data ->> 'content', '');
begin
  if tg_table_name in ('issues', 'announcements') then
    if char_length(btrim(title_value)) not between 1 and 30 then
      raise exception using errcode = '23514', message = 'title-too-long';
    end if;
    if app_private.visible_media_text_length(content_value) > 1000 then
      raise exception using errcode = '23514', message = 'content-too-long';
    end if;
  elsif tg_table_name in ('comments', 'announcement_comments')
    and app_private.visible_media_text_length(content_value) > 70 then
    raise exception using errcode = '23514', message = 'comment-too-long';
  end if;
  return new;
end;
$$;


--
-- Name: enforce_issue_comment_availability(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."enforce_issue_comment_availability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  new.comments_enabled := (
    new.status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
    and exists (
      select 1
      from app_private.issue_categories category
      where category.id = new.category
        and category.is_active
        and category.comments_enabled
    )
  );
  return new;
end;
$$;


--
-- Name: firebase_project_id(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."firebase_project_id"() RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
  select nullif(current_setting('app.firebase_project_id', true), '');
$$;


--
-- Name: firebase_uid(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."firebase_uid"() RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
  select nullif(current_setting('app.actor_uid', true), '');
$$;


--
-- Name: increment_platform_counter("text", bigint); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."increment_platform_counter"("counter_key" "text", "amount" bigint DEFAULT 1) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  insert into app_private.platform_counters(key, value)
  values (counter_key, greatest(amount, 0))
  on conflict (key) do update
  set value = app_private.platform_counters.value + greatest(excluded.value, 0),
      updated_at = now();
$$;


--
-- Name: is_admin("text"); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."is_admin"("uid" "text" DEFAULT "app_private"."firebase_uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  select exists (
    select 1
    from app_private.user_roles
    where user_roles.uid = is_admin.uid
      and role = 'admin'
  );
$$;


--
-- Name: is_expected_firebase_project(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."is_expected_firebase_project"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  select app_private.firebase_project_id() = (
    select value
    from app_private.runtime_settings
    where key = 'firebase_project_id'
  );
$$;


--
-- Name: issue_list_sort_date("app_private"."issues", "text", "text"); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."issue_list_sort_date"("issue_record" "app_private"."issues", "status_bucket" "text", "sort_name" "text") RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
  select case
    when sort_name = 'ending-soon' then issue_record.support_deadline_at
    when coalesce(status_bucket, 'active') = 'closed' then coalesce(issue_record.closed_at, issue_record.created_at)
    else coalesce(issue_record.review_approved_at, issue_record.created_at)
  end
$$;


--
-- Name: issue_realtime_audience("text", "text"); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."issue_realtime_audience"("category_name" "text", "status_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  settings_ready boolean;
begin
  select count(*) = 2 into settings_ready
  from app_private.runtime_settings
  where key in ('owner_admin_issue_categories', 'reviewed_school_issue_categories');

  if not settings_ready then
    return 'owner-admin';
  end if;
  if app_private.runtime_category_matches('owner_admin_issue_categories', category_name) then
    return 'owner-admin';
  end if;
  if app_private.runtime_category_matches('reviewed_school_issue_categories', category_name)
    and status_name in ('under-review', 'review-rejected')
  then
    return 'owner-admin';
  end if;
  return 'school';
end;
$$;


--
-- Name: issue_user_sort_date("app_private"."issues", "text"); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."issue_user_sort_date"("issue_record" "app_private"."issues", "sort_name" "text") RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
  select case
    when sort_name = 'ending-soon' then issue_record.support_deadline_at
    when issue_record.status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed') then coalesce(issue_record.closed_at, issue_record.created_at)
    else coalesce(issue_record.review_approved_at, issue_record.created_at)
  end
$$;


--
-- Name: prevent_announcement_comment_when_disabled(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."prevent_announcement_comment_when_disabled"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  perform 1
  from app_private.announcements announcement
  cross join app_private.system_setup setup
  where announcement.id = new.announcement_id
    and announcement.comments_enabled
    and setup.singleton
    and setup.announcement_comments_enabled
  for share of announcement, setup;
  if not found then raise exception 'comments-disabled'; end if;
  return new;
end;
$$;


--
-- Name: prevent_comment_when_disabled(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."prevent_comment_when_disabled"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  perform 1
  from app_private.issues issue
  join app_private.issue_categories category on category.id = issue.category
  where issue.id = new.issue_id
    and issue.comments_enabled
    and category.is_active
    and category.comments_enabled
    and issue.status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
  for share of issue, category;
  if not found then raise exception 'comments-disabled'; end if;
  return new;
end;
$$;


--
-- Name: prevent_issue_category_identity_change(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."prevent_issue_category_identity_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  if new.id is distinct from old.id
    or new.read_access is distinct from old.read_access
    or new.author_visible is distinct from old.author_visible then
    raise exception 'immutable-category-policy';
  end if;
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: prevent_issue_policy_snapshot_change(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."prevent_issue_policy_snapshot_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  if new.category is distinct from old.category
    or new.read_access is distinct from old.read_access
    or new.author_visible is distinct from old.author_visible
    or new.support_enabled is distinct from old.support_enabled
    or new.support_goal is distinct from old.support_goal
    or new.support_deadline_days is distinct from old.support_deadline_days
    or new.response_deadline_days is distinct from old.response_deadline_days then
    raise exception 'immutable-category-policy';
  end if;
  return new;
end;
$$;


--
-- Name: queue_announcement_change(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."queue_announcement_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare row_record app_private.announcements%rowtype;
begin
  if tg_op = 'DELETE' then row_record := old; else row_record := new; end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values(case when tg_op = 'INSERT' then 'announcement.created'
      when tg_op = 'UPDATE' then 'announcement.updated' else 'announcement.deleted' end,
    'announcement',row_record.id::text,row_record.author_uid,jsonb_build_object(
      'announcement_id',row_record.id,'author_uid',row_record.author_uid,'title',row_record.title
    ));
  return row_record;
end;
$$;


--
-- Name: queue_announcement_comment_created(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."queue_announcement_comment_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare announcement_record app_private.announcements%rowtype; parent_author_uid text;
begin
  select * into announcement_record
  from app_private.announcements where id = new.announcement_id;
  if new.parent_comment_id is not null then
    select author_uid into parent_author_uid
    from app_private.announcement_comments where id = new.parent_comment_id;
  end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('announcement.comment_created','announcement',new.announcement_id::text,new.author_uid,jsonb_build_object(
    'announcement_author_uid',announcement_record.author_uid,
    'announcement_id',new.announcement_id,'author_uid',new.author_uid,
    'comment_id',new.id,'parent_author_uid',parent_author_uid,
    'parent_comment_id',new.parent_comment_id,'title',announcement_record.title
  ));
  return new;
end;
$$;


--
-- Name: queue_announcement_comment_realtime_event(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."queue_announcement_comment_realtime_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  comment_record app_private.announcement_comments%rowtype;
begin
  if tg_op = 'DELETE' then
    comment_record := old;
  else
    comment_record := new;
  end if;
  perform app_private.emit_content_realtime_event(
    'announcement_comment_changed',
    'announcement_comment',
    comment_record.id::text,
    comment_record.announcement_id::text,
    null,
    'school',
    null,
    null,
    null,
    null,
    lower(tg_op)
  );
  return null;
end;
$$;


--
-- Name: queue_announcement_realtime_event(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."queue_announcement_realtime_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  announcement_record app_private.announcements%rowtype;
  next_event_type text := 'announcement_changed';
begin
  if tg_op = 'DELETE' then announcement_record := old; else announcement_record := new; end if;
  if tg_op = 'UPDATE'
    and (new.like_count is distinct from old.like_count or new.comment_count is distinct from old.comment_count)
    and (to_jsonb(new) - 'like_count' - 'comment_count') = (to_jsonb(old) - 'like_count' - 'comment_count')
  then next_event_type := 'announcement_metrics_changed'; end if;
  perform app_private.emit_content_realtime_event(
    next_event_type, 'announcement', announcement_record.id::text, announcement_record.id::text,
    null, 'school', null, null, announcement_record.like_count, announcement_record.comment_count,
    lower(tg_op)
  );
  return null;
end;
$$;


--
-- Name: queue_comment_created(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."queue_comment_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare issue_record app_private.issues%rowtype; parent_author_uid text;
begin
  select * into issue_record from app_private.issues where id = new.issue_id;
  if new.parent_comment_id is not null then
    select author_uid into parent_author_uid
    from app_private.comments where id = new.parent_comment_id;
  end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('issue.comment_created','issue',new.issue_id::text,new.author_uid,jsonb_build_object(
    'author_uid',new.author_uid,'comment_id',new.id,
    'issue_author_uid',issue_record.author_uid,'issue_category',issue_record.category,
    'issue_id',new.issue_id,'parent_author_uid',parent_author_uid,
    'parent_comment_id',new.parent_comment_id,'title',issue_record.title
  ));
  return new;
end;
$$;


--
-- Name: queue_deleted_content_uploads(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."queue_deleted_content_uploads"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare removed_upload_ids uuid[]; target_type_name text;
begin
  target_type_name := case tg_table_name
    when 'issues' then 'issue' when 'comments' then 'comment'
    when 'announcements' then 'announcement' when 'announcement_comments' then 'announcement_comment'
    when 'facility_reports' then 'facility' else null end;
  if target_type_name is null then raise exception 'unsupported-upload-target'; end if;
  select coalesce(array_agg(id), array[]::uuid[]) into removed_upload_ids from app_private.uploads
    where attached_target_type = target_type_name and attached_target_id = old.id;
  if cardinality(removed_upload_ids) > 0 then
    insert into app_private.deletion_jobs(target_type,target_id,cloudinary_public_id)
    select 'upload', id::text, cloudinary_public_id from app_private.uploads where id = any(removed_upload_ids);
    delete from app_private.uploads where id = any(removed_upload_ids);
  end if;
  return old;
end;
$$;


--
-- Name: queue_facility_realtime_event(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."queue_facility_realtime_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'realtime', 'public'
    AS $$
declare
  facility_record app_private.facility_reports%rowtype;
begin
  if tg_op = 'DELETE' then
    facility_record := old;
  else
    facility_record := new;
  end if;

  perform app_private.emit_content_realtime_event(
    'facility_changed',
    'facility',
    facility_record.id::text,
    facility_record.id::text,
    facility_record.category_id,
    'school',
    null,
    facility_record.affected_count,
    null,
    null,
    lower(tg_op)
  );
  return null;
end;
$$;


--
-- Name: queue_issue_change(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."queue_issue_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values('issue.created','issue',new.id::text,new.author_uid,jsonb_build_object(
      'author_uid',new.author_uid,'category',new.category,'issue_id',new.id,
      'status',new.status,'support_count',new.support_count,
      'support_goal',new.support_goal,'title',new.title
    ));
  elsif old.status is distinct from new.status then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values('issue.status_changed','issue',new.id::text,coalesce(new.last_actor_uid,'system'),jsonb_build_object(
      'author_uid',new.author_uid,'new_status',new.status,'old_status',old.status,
      'reason',new.review_rejection_reason,'support_count',new.support_count,
      'support_goal',new.support_goal,'title',new.title,'issue_category',new.category
    ));
  end if;
  return new;
end;
$$;


--
-- Name: queue_issue_comment_realtime_event(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."queue_issue_comment_realtime_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  comment_record app_private.comments%rowtype;
  issue_record app_private.issues%rowtype;
begin
  if tg_op = 'DELETE' then
    comment_record := old;
  else
    comment_record := new;
  end if;
  select * into issue_record from app_private.issues where id = comment_record.issue_id;
  perform app_private.emit_content_realtime_event(
    'issue_comment_changed',
    'issue_comment',
    comment_record.id::text,
    comment_record.issue_id::text,
    issue_record.category,
    case when found
      then app_private.issue_realtime_audience(issue_record.category, issue_record.status)
      else 'owner-admin'
    end,
    issue_record.author_uid,
    null,
    null,
    null,
    lower(tg_op)
  );
  return null;
end;
$$;


--
-- Name: queue_issue_realtime_event(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."queue_issue_realtime_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  issue_record app_private.issues%rowtype;
  next_event_type text := 'issue_changed';
begin
  if tg_op = 'DELETE' then issue_record := old; else issue_record := new; end if;
  if tg_op = 'UPDATE'
    and new.support_count is distinct from old.support_count
    and (to_jsonb(new) - 'support_count') = (to_jsonb(old) - 'support_count')
  then next_event_type := 'issue_support_changed'; end if;
  perform app_private.emit_content_realtime_event(
    next_event_type, 'issue', issue_record.id::text, issue_record.id::text,
    issue_record.category, app_private.issue_realtime_audience(issue_record.category, issue_record.status),
    issue_record.author_uid, issue_record.support_count, null, null,
    lower(tg_op)
  );
  return null;
end;
$$;


--
-- Name: queue_realtime_event("text", "text", "jsonb"); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."queue_realtime_event"("event_topic" "text", "event_name" "text", "event_payload" "jsonb") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'pg_catalog'
    AS $$
  insert into app_private.realtime_events (topic, event_name, payload)
  values (event_topic, event_name, event_payload);
$$;


--
-- Name: refresh_announcement_comment_count(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."refresh_announcement_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
declare
  changed_announcement_id uuid := coalesce(new.announcement_id, old.announcement_id);
begin
  update app_private.announcements
  set comment_count = (
    select count(*)::integer
    from app_private.announcement_comments
    where announcement_comments.announcement_id = changed_announcement_id
  )
  where id = changed_announcement_id;

  return null;
end;
$$;


--
-- Name: refresh_announcement_like_count(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."refresh_announcement_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
declare
  changed_announcement_id uuid := coalesce(new.announcement_id, old.announcement_id);
begin
  update app_private.announcements
  set like_count = (
    select count(*)::integer
    from app_private.announcement_likes
    where announcement_likes.announcement_id = changed_announcement_id
  )
  where id = changed_announcement_id;

  return null;
end;
$$;


--
-- Name: refresh_issue_support_count(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."refresh_issue_support_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare changed_issue_id uuid := coalesce(new.issue_id, old.issue_id);
begin
  update app_private.issues issue set support_count =
    case when issue.support_enabled then 1 else 0 end
    + (select count(*)::integer from app_private.supports where supports.issue_id = changed_issue_id)
  where issue.id = changed_issue_id;
  return null;
end;
$$;


--
-- Name: reject_expired_support_issues(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."reject_expired_support_issues"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  changed integer;
begin
  with expired as (
    update app_private.issues
    set status = 'auto-rejected'
    where status = 'pending'
      and support_enabled
      and support_met_at is null
      and support_deadline_at is not null
      and support_deadline_at <= now()
      and support_goal is not null
      and support_count < support_goal
    returning 1
  )
  select count(*) into changed from expired;

  return changed;
end;
$$;


--
-- Name: run_maintenance_cleanup("text"[], "jsonb"); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."run_maintenance_cleanup"("valid_issue_categories" "text"[] DEFAULT NULL::"text"[], "retention_config" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  cleanup_details jsonb := '{}'::jsonb;
  deleted_count integer := 0;
  queued_count integer := 0;
  failed_deletion_jobs integer := 0;
  failure_trace_id uuid;
  run_id uuid;
  run_status text := 'success';
  closed_issue_days integer := greatest(1, least(3650, coalesce((retention_config->>'closedIssuesDays')::integer, 365)));
  closed_facility_days integer := greatest(1, least(3650, coalesce((retention_config->>'closedFacilitiesDays')::integer, 365)));
  notifications_days integer := greatest(1, least(3650, coalesce((retention_config->>'notificationsDays')::integer, 7)));
  realtime_hours integer := greatest(1, least(87600, coalesce((retention_config->>'realtimeEventsHours')::integer, 24)));
  outbox_completed_days integer := greatest(1, least(3650, coalesce((retention_config->>'outboxCompletedDays')::integer, 1)));
  outbox_failed_days integer := greatest(1, least(3650, coalesce((retention_config->>'outboxFailedDays')::integer, 3)));
  push_sent_days integer := greatest(1, least(3650, coalesce((retention_config->>'pushDeliverySentDays')::integer, 1)));
  push_failed_days integer := greatest(1, least(3650, coalesce((retention_config->>'pushDeliveryFailedDays')::integer, 3)));
  idempotency_hours integer := greatest(1, least(87600, coalesce((retention_config->>'idempotencyHours')::integer, 24)));
  inactive_push_token_days integer := greatest(1, least(3650, coalesce((retention_config->>'inactivePushTokensDays')::integer, 90)));
  deletion_completed_days integer := greatest(1, least(3650, coalesce((retention_config->>'deletionJobCompletedDays')::integer, 1)));
  deletion_failed_days integer := greatest(1, least(3650, coalesce((retention_config->>'deletionJobFailedDays')::integer, 3)));
  maintenance_days integer := greatest(1, least(3650, coalesce((retention_config->>'maintenanceRunsDays')::integer, 7)));
  role_audit_days integer := greatest(1, least(3650, coalesce((retention_config->>'roleAssignmentAuditDays')::integer, 365)));
  pending_upload_hours integer := greatest(1, least(87600, coalesce((retention_config->>'pendingUploadHours')::integer, 24)));
  unattached_upload_hours integer := greatest(1, least(87600, coalesce((retention_config->>'unattachedUploadHours')::integer, 48)));
  failed_upload_hours integer := greatest(1, least(87600, coalesce((retention_config->>'failedUploadHours')::integer, 24)));
begin
  insert into app_private.maintenance_runs (task_name, status, started_at)
  values ('maintenance.cleanup', 'running', now())
  returning id into run_id;

  if valid_issue_categories is not null and array_length(valid_issue_categories, 1) > 0 then
    with removed_issues as materialized (
      select id, author_uid, category, title
      from app_private.issues
      where not (category = any(valid_issue_categories))
    ), queued_events as (
      insert into app_private.outbox_events (event_type, target_type, target_id, actor_uid, payload)
      select 'issue.deleted', 'issue', id::text, author_uid,
        jsonb_build_object('author_uid', author_uid, 'issue_category', category, 'issue_id', id, 'title', title)
      from removed_issues
      returning 1
    ), deleted_issues as (
      delete from app_private.issues where id in (select id from removed_issues) returning 1
    )
    select (select count(*) from deleted_issues), (select count(*) from queued_events)
    into deleted_count, queued_count;
    cleanup_details := cleanup_details || jsonb_build_object(
      'removed_category_issues_deleted', deleted_count,
      'removed_category_deletion_events_queued', queued_count
    );
  else
    cleanup_details := cleanup_details || jsonb_build_object(
      'removed_category_issues_deleted', 0,
      'removed_category_deletion_events_queued', 0
    );
  end if;

  with expired_issues as materialized (
    select id, author_uid, category, title
    from app_private.issues
    where status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed')
      and closed_at < now() - make_interval(days => closed_issue_days)
  ), queued_events as (
    insert into app_private.outbox_events (event_type, target_type, target_id, actor_uid, payload)
    select 'issue.deleted', 'issue', expired_issue.id::text, expired_issue.author_uid,
      jsonb_build_object(
        'author_uid', expired_issue.author_uid,
        'issue_category', expired_issue.category,
        'issue_id', expired_issue.id,
        'retention_cleanup', true,
        'title', expired_issue.title
      )
    from expired_issues expired_issue
    where exists (
      select 1 from app_private.notion_pages notion_page
      where notion_page.target_type = 'issue'
        and notion_page.target_id = expired_issue.id::text
    )
    returning 1
  ), deleted_issues as (
    delete from app_private.issues where id in (select id from expired_issues) returning 1
  )
  select (select count(*) from deleted_issues), (select count(*) from queued_events)
  into deleted_count, queued_count;
  cleanup_details := cleanup_details || jsonb_build_object(
    'expired_closed_issues_deleted', deleted_count,
    'expired_closed_issue_notion_deletions_queued', queued_count
  );

  with expired_facilities as materialized (
    select id, author_uid, title
    from app_private.facility_reports
    where status in ('completed', 'unable-to-handle')
      and closed_at < now() - make_interval(days => closed_facility_days)
  ), queued_events as (
    insert into app_private.outbox_events (event_type, target_type, target_id, actor_uid, payload)
    select 'facility.deleted', 'facility', expired_facility.id::text, expired_facility.author_uid,
      jsonb_build_object(
        'author_uid', expired_facility.author_uid,
        'retention_cleanup', true,
        'title', expired_facility.title
      )
    from expired_facilities expired_facility
    where exists (
      select 1 from app_private.notion_pages notion_page
      where notion_page.target_type = 'facility'
        and notion_page.target_id = expired_facility.id::text
    )
    returning 1
  ), deleted_facilities as (
    delete from app_private.facility_reports where id in (select id from expired_facilities) returning 1
  )
  select (select count(*) from deleted_facilities), (select count(*) from queued_events)
  into deleted_count, queued_count;
  cleanup_details := cleanup_details || jsonb_build_object(
    'expired_closed_facilities_deleted', deleted_count,
    'expired_closed_facility_notion_deletions_queued', queued_count
  );

  with stale_uploads as materialized (
    select id, cloudinary_public_id
    from app_private.uploads
    where cloudinary_public_id is not null and (
      (status = 'pending' and created_at < now() - make_interval(hours => pending_upload_hours))
      or (status = 'ready' and attached_target_id is null and updated_at < now() - make_interval(hours => unattached_upload_hours))
      or (status = 'failed' and updated_at < now() - make_interval(hours => failed_upload_hours))
    )
  ), queued_uploads as (
    insert into app_private.deletion_jobs (target_type, target_id, cloudinary_public_id)
    select 'upload', id::text, cloudinary_public_id from stale_uploads
    returning 1
  ), deleted_uploads as (
    delete from app_private.uploads where id in (select id from stale_uploads) returning 1
  )
  select (select count(*) from queued_uploads), (select count(*) from deleted_uploads)
  into queued_count, deleted_count;
  cleanup_details := cleanup_details || jsonb_build_object(
    'uploads_queued_for_deletion', queued_count,
    'uploads_deleted', deleted_count
  );

  update app_private.notifications
  set expires_at = created_at + make_interval(days => notifications_days)
  where expires_at is distinct from created_at + make_interval(days => notifications_days);
  delete from app_private.notifications where expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('notifications_deleted', deleted_count);

  update app_private.realtime_events
  set expires_at = created_at + make_interval(hours => realtime_hours)
  where expires_at is distinct from created_at + make_interval(hours => realtime_hours);
  delete from app_private.realtime_events where expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('realtime_events_deleted', deleted_count);

  update app_private.outbox_events
  set expires_at = updated_at + case status
    when 'completed' then make_interval(days => outbox_completed_days)
    else make_interval(days => outbox_failed_days)
  end
  where status in ('completed', 'failed');
  delete from app_private.outbox_events where status in ('completed', 'failed') and expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('outbox_events_deleted', deleted_count);

  delete from app_private.push_delivery_logs
  where (status = 'sent' and updated_at < now() - make_interval(days => push_sent_days))
    or (status = 'failed' and updated_at < now() - make_interval(days => push_failed_days));
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('push_delivery_logs_deleted', deleted_count);

  update app_private.idempotency_keys
  set expires_at = updated_at + make_interval(hours => idempotency_hours)
  where expires_at is distinct from updated_at + make_interval(hours => idempotency_hours);
  delete from app_private.idempotency_keys where expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('idempotency_keys_deleted', deleted_count);

  delete from app_private.push_tokens
  where permission <> 'granted'
    or updated_at < now() - make_interval(days => inactive_push_token_days);
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('push_tokens_deleted', deleted_count);

  delete from app_private.deletion_jobs
  where (status = 'completed' and updated_at < now() - make_interval(days => deletion_completed_days))
    or (status = 'failed' and updated_at < now() - make_interval(days => deletion_failed_days));
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('deletion_jobs_deleted', deleted_count);

  delete from app_private.role_assignment_audit
  where created_at < now() - make_interval(days => role_audit_days);
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('role_assignment_audit_deleted', deleted_count);

  select count(*)::integer into failed_deletion_jobs
  from app_private.deletion_jobs where status = 'failed';
  cleanup_details := cleanup_details || jsonb_build_object('failed_deletion_jobs', failed_deletion_jobs);
  if failed_deletion_jobs > 0 then run_status := 'attention'; end if;

  delete from app_private.maintenance_runs
  where task_name = 'maintenance.cleanup'
    and id <> run_id
    and started_at < now() - make_interval(days => maintenance_days);

  update app_private.maintenance_runs
  set status = run_status, completed_at = now(), details = cleanup_details
  where id = run_id;

  return jsonb_build_object('ok', true, 'run_id', run_id, 'status', run_status, 'details', cleanup_details);
exception
  when others then
    if run_id is not null then
      update app_private.maintenance_runs
      set status = 'failed', completed_at = now(), error_trace_id = gen_random_uuid(), details = cleanup_details
      where id = run_id
      returning error_trace_id into failure_trace_id;
      raise warning 'maintenance failure trace %, error %', failure_trace_id, sqlerrm;
    end if;
    raise;
end;
$$;


--
-- Name: runtime_category_matches("text", "text"); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."runtime_category_matches"("setting_key" "text", "category_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
  select coalesce(
    category_name = any(string_to_array((
      select value
      from app_private.runtime_settings
      where key = setting_key
    ), ',')),
    false
  );
$$;


--
-- Name: set_issue_closed_at(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."set_issue_closed_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  if new.status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed') then
    if tg_op = 'INSERT'
      or old.status is distinct from new.status
      or new.closed_at is null
    then
      new.closed_at := coalesce(new.closed_at, now());
    end if;
  else
    new.closed_at := null;
  end if;

  return new;
end;
$$;


--
-- Name: set_issue_derived_fields(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."set_issue_derived_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
begin
  new.title_search = lower(btrim(new.title));

  if new.support_goal is not null
    and new.support_count >= new.support_goal
    and new.support_met_at is null
  then
    new.support_met_at = now();
  end if;

  return new;
end;
$$;


--
-- Name: signal_due_background_workers(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."signal_due_background_workers"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'app_api', 'public'
    AS $$
begin
  perform app_api.resignal_background_worker('outbox');
  perform app_api.resignal_background_worker('deletion');
end;
$$;


--
-- Name: skip_duplicate_active_deletion_job(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."skip_duplicate_active_deletion_job"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
begin
  if new.cloudinary_public_id is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.cloudinary_public_id, 0));
  if exists (
    select 1
    from app_private.deletion_jobs
    where cloudinary_public_id = new.cloudinary_public_id
      and status in ('pending', 'processing', 'failed')
  ) then
    return null;
  end if;
  return new;
end;
$$;


--
-- Name: skip_identical_outbox_update(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."skip_identical_outbox_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
begin
  if new is not distinct from old then
    return null;
  end if;
  return new;
end;
$$;


--
-- Name: snapshot_issue_category_defaults(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."snapshot_issue_category_defaults"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare category_record app_private.issue_categories%rowtype;
begin
  select * into category_record from app_private.issue_categories
  where id = new.category and is_active;
  if not found then raise exception 'invalid-issue-category'; end if;
  new.comments_enabled := category_record.comments_enabled;
  new.read_access := category_record.read_access;
  new.author_visible := category_record.author_visible;
  new.support_deadline_days := category_record.support_deadline_days;
  new.response_deadline_days := category_record.response_deadline_days;
  return new;
end;
$$;


--
-- Name: touch_facility_category(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."touch_facility_category"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  if new.id is distinct from old.id then raise exception 'immutable-category-policy'; end if;
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: touch_platform_activity(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."touch_platform_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  insert into app_private.runtime_settings(key, value, updated_at)
  values ('last_activity_at', now()::text, now())
  on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at;
  return null;
end;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: track_comment_category_counter(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."track_comment_category_counter"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  old_category text;
  new_category text;
begin
  if tg_op <> 'INSERT' then
    select category into old_category
    from app_private.issues
    where id = old.issue_id;
  end if;
  if tg_op <> 'DELETE' then
    select category into new_category
    from app_private.issues
    where id = new.issue_id;
  end if;

  if tg_op = 'INSERT' then
    perform app_private.adjust_category_counter(new_category, 0, 1);
  elsif tg_op = 'DELETE' and old_category is not null then
    perform app_private.adjust_category_counter(old_category, 0, -1);
  elsif tg_op = 'UPDATE' and new.issue_id is distinct from old.issue_id then
    if old_category is not null then
      perform app_private.adjust_category_counter(old_category, 0, -1);
    end if;
    if new_category is not null then
      perform app_private.adjust_category_counter(new_category, 0, 1);
    end if;
  end if;
  return null;
end;
$$;


--
-- Name: track_issue_category_counter(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."track_issue_category_counter"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare
  related_comments bigint := 0;
begin
  if tg_op = 'INSERT' then
    perform app_private.adjust_category_counter(new.category, 1, 0);
  elsif tg_op = 'DELETE' then
    select count(*) into related_comments
    from app_private.comments
    where issue_id = old.id;
    perform app_private.adjust_category_counter(old.category, -1, -related_comments);
  elsif new.category is distinct from old.category then
    select count(*) into related_comments
    from app_private.comments
    where issue_id = new.id;
    perform app_private.adjust_category_counter(old.category, -1, -related_comments);
    perform app_private.adjust_category_counter(new.category, 1, related_comments);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


--
-- Name: track_platform_row_change(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."track_platform_row_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  if tg_table_name = 'issues' then
    perform app_private.increment_platform_counter(case when tg_op = 'INSERT' then 'issues_created' else 'issues_deleted' end);
  elsif tg_table_name in ('comments', 'announcement_comments') then
    perform app_private.increment_platform_counter(case when tg_op = 'INSERT' then 'comments_created' else 'comments_deleted' end);
  elsif tg_table_name = 'supports' then
    perform app_private.increment_platform_counter(case when tg_op = 'INSERT' then 'supports_added' else 'supports_removed' end);
  end if;
  return null;
end;
$$;


--
-- Name: track_user_seen_counter(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."track_user_seen_counter"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  insert into app_private.platform_counters(key, value) values ('users_seen', 1)
  on conflict(key) do update set value = app_private.platform_counters.value + 1, updated_at = now();
  return null;
end;
$$;


--
-- Name: update_announcement_comment_setting("text", boolean); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."update_announcement_comment_setting"("actor_uid" "text", "enabled" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_private', 'public'
    AS $$
declare previous_enabled boolean;
begin
  select announcement_comments_enabled into previous_enabled
  from app_private.system_setup where singleton for update;
  update app_private.system_setup
  set announcement_comments_enabled = enabled, updated_at = now()
  where singleton;
  insert into app_private.category_configuration_audit(
    domain,operation,actor_uid,before_value,after_value
  ) values (
    'setup','update-features',actor_uid,
    jsonb_build_object('announcementCommentsEnabled',previous_enabled),
    jsonb_build_object('announcementCommentsEnabled',enabled)
  );
end;
$$;


--
-- Name: validate_announcement_comment_parent(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."validate_announcement_comment_parent"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
declare
  parent_announcement_id uuid;
  parent_parent_id uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select announcement_id, parent_comment_id
  into parent_announcement_id, parent_parent_id
  from app_private.announcement_comments
  where id = new.parent_comment_id;

  if parent_announcement_id is null
    or parent_announcement_id <> new.announcement_id
    or parent_parent_id is not null then
    raise exception 'invalid announcement comment parent';
  end if;

  return new;
end $$;


--
-- Name: validate_comment_parent(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."validate_comment_parent"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'app_private'
    AS $$
declare
  parent_issue_id uuid;
  parent_parent_id uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select issue_id, parent_comment_id
  into parent_issue_id, parent_parent_id
  from app_private.comments
  where id = new.parent_comment_id;

  if parent_issue_id is null
    or parent_issue_id <> new.issue_id
    or parent_parent_id is not null then
    raise exception 'invalid comment parent';
  end if;

  return new;
end $$;


--
-- Name: version_user_public_profile(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."version_user_public_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app_private', 'public'
    AS $$
begin
  if new.display_name is distinct from old.display_name
    or new.photo_url is distinct from old.photo_url
    or new.cached_photo_url is distinct from old.cached_photo_url
    or new.avatar_version is distinct from old.avatar_version then
    new.profile_version := old.profile_version + 1;
  end if;
  return new;
end;
$$;


--
-- Name: visible_media_text_length("text"); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION "app_private"."visible_media_text_length"("value" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'app_private', 'public'
    AS $$
  select char_length(btrim(regexp_replace(
    coalesce(value, ''),
    E'!\\[[^]]*\\]\\(srp-upload://[^)]+\\)',
    '',
    'g'
  )));
$$;


--
-- Name: access_assignment_audit; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."access_assignment_audit" (
    "id" bigint NOT NULL,
    "actor_uid" "text" NOT NULL,
    "target_uid" "text" NOT NULL,
    "before_value" "jsonb" NOT NULL,
    "after_value" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: access_assignment_audit_id_seq; Type: SEQUENCE; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."access_assignment_audit" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "app_private"."access_assignment_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: announcement_likes; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."announcement_likes" (
    "announcement_id" "uuid" NOT NULL,
    "uid" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: category_configuration_audit; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."category_configuration_audit" (
    "id" bigint NOT NULL,
    "domain" "text" NOT NULL,
    "category_id" "text",
    "operation" "text" NOT NULL,
    "actor_uid" "text" NOT NULL,
    "before_value" "jsonb",
    "after_value" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "category_configuration_audit_domain_check" CHECK (("domain" = ANY (ARRAY['issue'::"text", 'facility'::"text", 'setup'::"text"]))),
    CONSTRAINT "category_configuration_audit_operation_check" CHECK (("operation" = ANY (ARRAY['create'::"text", 'update'::"text", 'archive'::"text", 'restore'::"text", 'delete'::"text", 'complete-setup'::"text", 'update-features'::"text"])))
);


--
-- Name: category_configuration_audit_id_seq; Type: SEQUENCE; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."category_configuration_audit" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "app_private"."category_configuration_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: content_versions; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."content_versions" (
    "domain" "text" NOT NULL,
    "version" bigint DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_revisions_revision_check" CHECK (("version" > 0)),
    CONSTRAINT "content_versions_domain_check" CHECK (("domain" = ANY (ARRAY['issues'::"text", 'announcements'::"text", 'facilities'::"text"])))
);


--
-- Name: facility_categories; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."facility_categories" (
    "id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "facility_categories_always_active_check" CHECK ("is_active"),
    CONSTRAINT "facility_categories_id_check" CHECK (("id" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text")),
    CONSTRAINT "facility_categories_label_check" CHECK ((("length"("btrim"("label")) >= 1) AND ("length"("btrim"("label")) <= 40)))
);


--
-- Name: facility_report_affected_users; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."facility_report_affected_users" (
    "facility_id" "uuid" NOT NULL,
    "uid" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: facility_reports; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."facility_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_uid" "text" NOT NULL,
    "title" "text" NOT NULL,
    "title_search" "text" NOT NULL,
    "location" "text" NOT NULL,
    "content" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "affected_count" integer DEFAULT 1 NOT NULL,
    "result_content" "text",
    "last_actor_uid" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_id" "text" NOT NULL,
    CONSTRAINT "facility_reports_affected_count_check" CHECK (("affected_count" >= 1)),
    CONSTRAINT "facility_reports_content_check" CHECK ((("length"("btrim"("content")) >= 0) AND ("length"("btrim"("content")) <= 8192))),
    CONSTRAINT "facility_reports_location_check" CHECK ((("length"("btrim"("location")) >= 1) AND ("length"("btrim"("location")) <= 120))),
    CONSTRAINT "facility_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'unable-to-handle'::"text"]))),
    CONSTRAINT "facility_reports_title_check" CHECK ((("length"("btrim"("title")) >= 1) AND ("length"("btrim"("title")) <= 30)))
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."idempotency_keys" (
    "uid" "text" NOT NULL,
    "action" "text" NOT NULL,
    "request_id" "text" NOT NULL,
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    CONSTRAINT "idempotency_keys_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text"])))
);


--
-- Name: issue_categories; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."issue_categories" (
    "id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "read_access" "text" NOT NULL,
    "author_visible" boolean NOT NULL,
    "support_enabled" boolean DEFAULT false NOT NULL,
    "support_goal" integer,
    "support_deadline_days" integer,
    "response_deadline_days" integer,
    "comments_enabled" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "issue_categories_always_active_check" CHECK ("is_active"),
    CONSTRAINT "issue_categories_check" CHECK ((("support_enabled" AND ("support_goal" IS NOT NULL) AND ("support_deadline_days" IS NOT NULL)) OR ((NOT "support_enabled") AND ("support_goal" IS NULL) AND ("support_deadline_days" IS NULL)))),
    CONSTRAINT "issue_categories_check1" CHECK ((("read_access" <> 'owner-admin'::"text") OR "author_visible")),
    CONSTRAINT "issue_categories_id_check" CHECK (("id" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text")),
    CONSTRAINT "issue_categories_label_check" CHECK ((("length"("btrim"("label")) >= 1) AND ("length"("btrim"("label")) <= 40))),
    CONSTRAINT "issue_categories_read_access_check" CHECK (("read_access" = ANY (ARRAY['school'::"text", 'reviewed-school'::"text", 'owner-admin'::"text"]))),
    CONSTRAINT "issue_categories_response_deadline_days_check" CHECK ((("response_deadline_days" IS NULL) OR ("response_deadline_days" > 0))),
    CONSTRAINT "issue_categories_support_deadline_days_check" CHECK ((("support_deadline_days" IS NULL) OR ("support_deadline_days" > 0))),
    CONSTRAINT "issue_categories_support_goal_check" CHECK ((("support_goal" IS NULL) OR ("support_goal" > 0)))
);


--
-- Name: maintenance_runs; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."maintenance_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_name" "text" NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "error_trace_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


--
-- Name: notion_pages; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."notion_pages" (
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "notion_page_id" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "managed_block_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "content_hash" "text"
);


--
-- Name: permissions; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."permissions" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL
);


--
-- Name: platform_category_counters; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."platform_category_counters" (
    "category" "text" NOT NULL,
    "issues" bigint DEFAULT 0 NOT NULL,
    "comments" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "platform_category_counters_comments_check" CHECK (("comments" >= 0)),
    CONSTRAINT "platform_category_counters_issues_check" CHECK (("issues" >= 0))
)
WITH ("autovacuum_vacuum_threshold"='20', "autovacuum_vacuum_scale_factor"='0', "autovacuum_analyze_threshold"='20', "autovacuum_analyze_scale_factor"='0');


--
-- Name: platform_counters; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."platform_counters" (
    "key" "text" NOT NULL,
    "value" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_counters_value_check" CHECK (("value" >= 0))
)
WITH ("autovacuum_vacuum_threshold"='20', "autovacuum_vacuum_scale_factor"='0', "autovacuum_analyze_threshold"='20', "autovacuum_analyze_scale_factor"='0');


--
-- Name: push_tokens; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."push_tokens" (
    "uid" "text" NOT NULL,
    "device_id" "text" NOT NULL,
    "token" "text" NOT NULL,
    "permission" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "user_agent" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "topic_broadcast" boolean DEFAULT false NOT NULL,
    CONSTRAINT "push_tokens_device_id_not_blank" CHECK (("length"("btrim"("device_id")) > 0)),
    CONSTRAINT "push_tokens_length_check" CHECK ((("char_length"("device_id") <= 160) AND ("char_length"("token") <= 4096) AND ("char_length"("platform") <= 120) AND ("char_length"("user_agent") <= 512))),
    CONSTRAINT "push_tokens_permission_check" CHECK (("permission" = ANY (ARRAY['default'::"text", 'denied'::"text", 'granted'::"text"]))),
    CONSTRAINT "push_tokens_token_not_blank" CHECK (("length"("btrim"("token")) > 0))
);


--
-- Name: role_assignment_audit; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."role_assignment_audit" (
    "id" bigint NOT NULL,
    "uid" "text" NOT NULL,
    "role_code" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "actor_uid" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "role_assignment_audit_operation_check" CHECK (("operation" = ANY (ARRAY['grant'::"text", 'revoke'::"text"])))
);


--
-- Name: role_assignment_audit_id_seq; Type: SEQUENCE; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."role_assignment_audit" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "app_private"."role_assignment_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: role_permissions; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."role_permissions" (
    "role_code" "text" NOT NULL,
    "permission_code" "text" NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."roles" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: runtime_settings; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."runtime_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
)
WITH ("autovacuum_vacuum_threshold"='20', "autovacuum_vacuum_scale_factor"='0', "autovacuum_analyze_threshold"='20', "autovacuum_analyze_scale_factor"='0');


--
-- Name: supports; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."supports" (
    "issue_id" "uuid" NOT NULL,
    "uid" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: system_setup; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."system_setup" (
    "singleton" boolean DEFAULT true NOT NULL,
    "completed_at" timestamp with time zone,
    "completed_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "issues_enabled" boolean DEFAULT true NOT NULL,
    "facilities_enabled" boolean DEFAULT true NOT NULL,
    "announcement_comments_enabled" boolean DEFAULT true NOT NULL,
    CONSTRAINT "system_setup_singleton_check" CHECK ("singleton")
);


--
-- Name: uploads; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_uid" "text" NOT NULL,
    "cloudinary_public_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "visibility" "text" NOT NULL,
    "attached_target_type" "text",
    "attached_target_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "width" integer,
    "height" integer,
    "size_bytes" integer,
    "content_type" "text",
    CONSTRAINT "uploads_dimensions_non_negative" CHECK (((("width" IS NULL) OR ("width" >= 0)) AND (("height" IS NULL) OR ("height" >= 0)) AND (("size_bytes" IS NULL) OR ("size_bytes" >= 0)))),
    CONSTRAINT "uploads_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'ready'::"text", 'attached'::"text", 'failed'::"text"]))),
    CONSTRAINT "uploads_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text", 'authenticated'::"text"])))
);


--
-- Name: user_facility_category_assignments; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."user_facility_category_assignments" (
    "uid" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "notify_on_created" boolean DEFAULT true NOT NULL,
    "granted_by" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: user_issue_category_assignments; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."user_issue_category_assignments" (
    "uid" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "granted_by" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: user_profiles; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."user_profiles" (
    "uid" "text" NOT NULL,
    "display_name" "text" DEFAULT '匿名使用者'::"text" NOT NULL,
    "photo_url" "text",
    "cached_photo_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone,
    "avatar_public_id" "text",
    "avatar_source_url" "text",
    "avatar_hash" "text",
    "avatar_version" integer DEFAULT 0 NOT NULL,
    "email" "text",
    "profile_version" bigint DEFAULT 1 NOT NULL,
    "avatar_checked_at" timestamp with time zone
);


--
-- Name: user_role_assignments; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."user_role_assignments" (
    "uid" "text" NOT NULL,
    "role_code" "text" NOT NULL,
    "granted_by" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE "app_private"."user_roles" (
    "uid" "text" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_roles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text"])))
);


--
-- Name: access_assignment_audit access_assignment_audit_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."access_assignment_audit"
    ADD CONSTRAINT "access_assignment_audit_pkey" PRIMARY KEY ("id");


--
-- Name: announcement_comments announcement_comments_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."announcement_comments"
    ADD CONSTRAINT "announcement_comments_pkey" PRIMARY KEY ("id");


--
-- Name: announcement_likes announcement_likes_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."announcement_likes"
    ADD CONSTRAINT "announcement_likes_pkey" PRIMARY KEY ("announcement_id", "uid");


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");


--
-- Name: category_configuration_audit category_configuration_audit_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."category_configuration_audit"
    ADD CONSTRAINT "category_configuration_audit_pkey" PRIMARY KEY ("id");


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");


--
-- Name: content_versions content_revisions_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."content_versions"
    ADD CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("domain");


--
-- Name: deletion_jobs deletion_jobs_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."deletion_jobs"
    ADD CONSTRAINT "deletion_jobs_pkey" PRIMARY KEY ("id");


--
-- Name: facility_categories facility_categories_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."facility_categories"
    ADD CONSTRAINT "facility_categories_pkey" PRIMARY KEY ("id");


--
-- Name: facility_report_affected_users facility_report_affected_users_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."facility_report_affected_users"
    ADD CONSTRAINT "facility_report_affected_users_pkey" PRIMARY KEY ("facility_id", "uid");


--
-- Name: facility_reports facility_reports_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."facility_reports"
    ADD CONSTRAINT "facility_reports_pkey" PRIMARY KEY ("id");


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("uid", "action", "request_id");


--
-- Name: issue_categories issue_categories_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."issue_categories"
    ADD CONSTRAINT "issue_categories_pkey" PRIMARY KEY ("id");


--
-- Name: issues issues_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."issues"
    ADD CONSTRAINT "issues_pkey" PRIMARY KEY ("id");


--
-- Name: maintenance_runs maintenance_runs_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."maintenance_runs"
    ADD CONSTRAINT "maintenance_runs_pkey" PRIMARY KEY ("id");


--
-- Name: notification_states notification_states_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."notification_states"
    ADD CONSTRAINT "notification_states_pkey" PRIMARY KEY ("uid");


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");


--
-- Name: notion_pages notion_pages_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."notion_pages"
    ADD CONSTRAINT "notion_pages_pkey" PRIMARY KEY ("target_type", "target_id");


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."outbox_events"
    ADD CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id");


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("code");


--
-- Name: platform_category_counters platform_category_counters_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."platform_category_counters"
    ADD CONSTRAINT "platform_category_counters_pkey" PRIMARY KEY ("category");


--
-- Name: platform_counters platform_counters_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."platform_counters"
    ADD CONSTRAINT "platform_counters_pkey" PRIMARY KEY ("key");


--
-- Name: push_delivery_logs push_delivery_logs_delivery_key_key; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."push_delivery_logs"
    ADD CONSTRAINT "push_delivery_logs_delivery_key_key" UNIQUE ("delivery_key");


--
-- Name: push_delivery_logs push_delivery_logs_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."push_delivery_logs"
    ADD CONSTRAINT "push_delivery_logs_pkey" PRIMARY KEY ("id");


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("uid", "device_id");


--
-- Name: realtime_events realtime_events_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."realtime_events"
    ADD CONSTRAINT "realtime_events_pkey" PRIMARY KEY ("id");


--
-- Name: role_assignment_audit role_assignment_audit_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."role_assignment_audit"
    ADD CONSTRAINT "role_assignment_audit_pkey" PRIMARY KEY ("id");


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_code", "permission_code");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("code");


--
-- Name: runtime_settings runtime_settings_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."runtime_settings"
    ADD CONSTRAINT "runtime_settings_pkey" PRIMARY KEY ("key");


--
-- Name: supports supports_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."supports"
    ADD CONSTRAINT "supports_pkey" PRIMARY KEY ("issue_id", "uid");


--
-- Name: system_setup system_setup_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."system_setup"
    ADD CONSTRAINT "system_setup_pkey" PRIMARY KEY ("singleton");


--
-- Name: uploads uploads_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."uploads"
    ADD CONSTRAINT "uploads_pkey" PRIMARY KEY ("id");


--
-- Name: user_facility_category_assignments user_facility_category_assignments_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."user_facility_category_assignments"
    ADD CONSTRAINT "user_facility_category_assignments_pkey" PRIMARY KEY ("uid", "category_id");


--
-- Name: user_issue_category_assignments user_issue_category_assignments_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."user_issue_category_assignments"
    ADD CONSTRAINT "user_issue_category_assignments_pkey" PRIMARY KEY ("uid", "category_id");


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("uid");


--
-- Name: user_role_assignments user_role_assignments_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("uid", "role_code");


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("uid");


--
-- Name: access_assignment_audit_target_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "access_assignment_audit_target_created_idx" ON "app_private"."access_assignment_audit" USING "btree" ("target_uid", "created_at" DESC, "id" DESC);


--
-- Name: announcement_comments_announcement_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "announcement_comments_announcement_created_idx" ON "app_private"."announcement_comments" USING "btree" ("announcement_id", "created_at", "id");


--
-- Name: announcement_comments_announcement_root_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "announcement_comments_announcement_root_created_idx" ON "app_private"."announcement_comments" USING "btree" ("announcement_id", "created_at", "id") WHERE ("parent_comment_id" IS NULL);


--
-- Name: announcement_comments_parent_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "announcement_comments_parent_created_idx" ON "app_private"."announcement_comments" USING "btree" ("parent_comment_id", "created_at", "id") WHERE ("parent_comment_id" IS NOT NULL);


--
-- Name: announcement_likes_uid_announcement_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "announcement_likes_uid_announcement_idx" ON "app_private"."announcement_likes" USING "btree" ("uid", "announcement_id");


--
-- Name: announcements_comment_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "announcements_comment_idx" ON "app_private"."announcements" USING "btree" ("comment_count" DESC, "published_at" DESC, "id" DESC);


--
-- Name: announcements_like_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "announcements_like_idx" ON "app_private"."announcements" USING "btree" ("like_count" DESC, "published_at" DESC, "id" DESC);


--
-- Name: announcements_published_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "announcements_published_idx" ON "app_private"."announcements" USING "btree" ("published_at" DESC, "id" DESC);


--
-- Name: category_configuration_audit_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "category_configuration_audit_created_idx" ON "app_private"."category_configuration_audit" USING "btree" ("created_at" DESC, "id" DESC);


--
-- Name: comments_issue_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "comments_issue_created_idx" ON "app_private"."comments" USING "btree" ("issue_id", "created_at", "id");


--
-- Name: comments_issue_root_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "comments_issue_root_created_idx" ON "app_private"."comments" USING "btree" ("issue_id", "created_at", "id") WHERE ("parent_comment_id" IS NULL);


--
-- Name: comments_parent_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "comments_parent_created_idx" ON "app_private"."comments" USING "btree" ("parent_comment_id", "created_at", "id") WHERE ("parent_comment_id" IS NOT NULL);


--
-- Name: deletion_jobs_active_cloudinary_unique_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE UNIQUE INDEX "deletion_jobs_active_cloudinary_unique_idx" ON "app_private"."deletion_jobs" USING "btree" ("cloudinary_public_id") WHERE (("cloudinary_public_id" IS NOT NULL) AND ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'failed'::"text"])));


--
-- Name: deletion_jobs_claim_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "deletion_jobs_claim_idx" ON "app_private"."deletion_jobs" USING "btree" ("status", "next_attempt_at", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text"]));


--
-- Name: deletion_jobs_completed_updated_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "deletion_jobs_completed_updated_idx" ON "app_private"."deletion_jobs" USING "btree" ("status", "updated_at") WHERE ("status" = ANY (ARRAY['completed'::"text", 'failed'::"text"]));


--
-- Name: deletion_jobs_stale_processing_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "deletion_jobs_stale_processing_idx" ON "app_private"."deletion_jobs" USING "btree" ("locked_at") WHERE (("status" = 'processing'::"text") AND ("attempt_count" < 8));


--
-- Name: facility_affected_uid_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "facility_affected_uid_idx" ON "app_private"."facility_report_affected_users" USING "btree" ("uid", "facility_id");


--
-- Name: facility_categories_active_order_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "facility_categories_active_order_idx" ON "app_private"."facility_categories" USING "btree" ("is_active", "sort_order", "created_at", "id");


--
-- Name: facility_categories_single_default_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE UNIQUE INDEX "facility_categories_single_default_idx" ON "app_private"."facility_categories" USING "btree" ("is_default") WHERE "is_default";


--
-- Name: facility_reports_author_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "facility_reports_author_created_idx" ON "app_private"."facility_reports" USING "btree" ("author_uid", "created_at" DESC);


--
-- Name: facility_reports_category_status_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "facility_reports_category_status_created_idx" ON "app_private"."facility_reports" USING "btree" ("category_id", "status", "created_at" DESC, "id" DESC);


--
-- Name: facility_reports_closed_retention_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "facility_reports_closed_retention_idx" ON "app_private"."facility_reports" USING "btree" ("closed_at") WHERE ("status" = ANY (ARRAY['completed'::"text", 'unable-to-handle'::"text"]));


--
-- Name: facility_reports_location_search_trgm_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "facility_reports_location_search_trgm_idx" ON "app_private"."facility_reports" USING "gin" ("lower"("location") "extensions"."gin_trgm_ops");


--
-- Name: facility_reports_status_affected_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "facility_reports_status_affected_idx" ON "app_private"."facility_reports" USING "btree" ("status", "affected_count" DESC, "id" DESC);


--
-- Name: facility_reports_status_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "facility_reports_status_created_idx" ON "app_private"."facility_reports" USING "btree" ("status", "created_at" DESC, "id" DESC);


--
-- Name: facility_reports_title_search_trgm_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "facility_reports_title_search_trgm_idx" ON "app_private"."facility_reports" USING "gin" ("title_search" "extensions"."gin_trgm_ops");


--
-- Name: idempotency_keys_expiry_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "idempotency_keys_expiry_idx" ON "app_private"."idempotency_keys" USING "btree" ("expires_at");


--
-- Name: issue_categories_active_order_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "issue_categories_active_order_idx" ON "app_private"."issue_categories" USING "btree" ("is_active", "sort_order", "created_at", "id");


--
-- Name: issue_categories_single_default_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE UNIQUE INDEX "issue_categories_single_default_idx" ON "app_private"."issue_categories" USING "btree" ("is_default") WHERE "is_default";


--
-- Name: issues_author_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "issues_author_created_idx" ON "app_private"."issues" USING "btree" ("author_uid", "created_at" DESC, "id" DESC);


--
-- Name: issues_category_closed_at_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "issues_category_closed_at_idx" ON "app_private"."issues" USING "btree" ("category", "closed_at" DESC, "id" DESC) WHERE ("status" = ANY (ARRAY['auto-rejected'::"text", 'review-rejected'::"text", 'infeasible'::"text", 'completed'::"text"]));


--
-- Name: issues_category_status_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "issues_category_status_created_idx" ON "app_private"."issues" USING "btree" ("category", "status", "created_at" DESC, "id" DESC);


--
-- Name: issues_category_status_support_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "issues_category_status_support_idx" ON "app_private"."issues" USING "btree" ("category", "status", "support_count" DESC, "created_at" DESC, "id" DESC);


--
-- Name: issues_closed_retention_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "issues_closed_retention_idx" ON "app_private"."issues" USING "btree" ("closed_at") WHERE ("status" = ANY (ARRAY['auto-rejected'::"text", 'review-rejected'::"text", 'infeasible'::"text", 'completed'::"text"]));


--
-- Name: issues_title_search_trgm_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "issues_title_search_trgm_idx" ON "app_private"."issues" USING "gin" ("title_search" "extensions"."gin_trgm_ops");


--
-- Name: maintenance_runs_task_started_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "maintenance_runs_task_started_idx" ON "app_private"."maintenance_runs" USING "btree" ("task_name", "started_at" DESC);


--
-- Name: notifications_comment_id_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "notifications_comment_id_idx" ON "app_private"."notifications" USING "btree" ("comment_id") WHERE ("comment_id" IS NOT NULL);


--
-- Name: notifications_expires_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "notifications_expires_idx" ON "app_private"."notifications" USING "btree" ("expires_at");


--
-- Name: notifications_recipient_source_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "notifications_recipient_source_created_idx" ON "app_private"."notifications" USING "btree" ("recipient_uid", "source", "created_at" DESC, "id" DESC) WHERE ("recipient_uid" IS NOT NULL);


--
-- Name: notifications_source_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "notifications_source_created_idx" ON "app_private"."notifications" USING "btree" ("source", "created_at" DESC, "id" DESC);


--
-- Name: outbox_events_claim_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "outbox_events_claim_idx" ON "app_private"."outbox_events" USING "btree" ("status", "next_attempt_at", "occurred_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text"]));


--
-- Name: outbox_events_expiry_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "outbox_events_expiry_idx" ON "app_private"."outbox_events" USING "btree" ("expires_at") WHERE ("status" = ANY (ARRAY['completed'::"text", 'failed'::"text"]));


--
-- Name: outbox_events_stale_processing_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "outbox_events_stale_processing_idx" ON "app_private"."outbox_events" USING "btree" ("locked_at") WHERE (("status" = 'processing'::"text") AND ("attempt_count" < 8));


--
-- Name: push_delivery_logs_retry_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "push_delivery_logs_retry_idx" ON "app_private"."push_delivery_logs" USING "btree" ("next_attempt_at", "created_at") WHERE (("status" = ANY (ARRAY['pending'::"text", 'failed'::"text", 'processing'::"text"])) AND ("notification" IS NOT NULL));


--
-- Name: push_delivery_logs_status_updated_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "push_delivery_logs_status_updated_idx" ON "app_private"."push_delivery_logs" USING "btree" ("status", "updated_at" DESC);


--
-- Name: push_delivery_logs_target_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "push_delivery_logs_target_idx" ON "app_private"."push_delivery_logs" USING "btree" ("target_type", "target_id", "created_at" DESC);


--
-- Name: push_tokens_token_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "push_tokens_token_idx" ON "app_private"."push_tokens" USING "btree" ("token");


--
-- Name: push_tokens_topic_broadcast_fallback_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "push_tokens_topic_broadcast_fallback_idx" ON "app_private"."push_tokens" USING "btree" ("uid") WHERE ("topic_broadcast" = false);


--
-- Name: push_tokens_updated_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "push_tokens_updated_idx" ON "app_private"."push_tokens" USING "btree" ("updated_at");


--
-- Name: realtime_events_claim_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "realtime_events_claim_idx" ON "app_private"."realtime_events" USING "btree" ("next_attempt_at", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text", 'processing'::"text"]));


--
-- Name: realtime_events_expiry_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "realtime_events_expiry_idx" ON "app_private"."realtime_events" USING "btree" ("expires_at");


--
-- Name: role_assignment_audit_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "role_assignment_audit_created_idx" ON "app_private"."role_assignment_audit" USING "btree" ("created_at");


--
-- Name: role_assignment_audit_uid_created_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "role_assignment_audit_uid_created_idx" ON "app_private"."role_assignment_audit" USING "btree" ("uid", "created_at" DESC);


--
-- Name: supports_uid_issue_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "supports_uid_issue_idx" ON "app_private"."supports" USING "btree" ("uid", "issue_id");


--
-- Name: uploads_cleanup_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "uploads_cleanup_idx" ON "app_private"."uploads" USING "btree" ("status", "updated_at", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'ready'::"text", 'failed'::"text"]));


--
-- Name: uploads_owner_status_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "uploads_owner_status_idx" ON "app_private"."uploads" USING "btree" ("owner_uid", "status", "created_at" DESC);


--
-- Name: user_facility_category_assignments_category_uid_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "user_facility_category_assignments_category_uid_idx" ON "app_private"."user_facility_category_assignments" USING "btree" ("category_id", "uid");


--
-- Name: user_issue_category_assignments_category_uid_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "user_issue_category_assignments_category_uid_idx" ON "app_private"."user_issue_category_assignments" USING "btree" ("category_id", "uid");


--
-- Name: user_profiles_avatar_public_id_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "user_profiles_avatar_public_id_idx" ON "app_private"."user_profiles" USING "btree" ("avatar_public_id") WHERE ("avatar_public_id" IS NOT NULL);


--
-- Name: user_profiles_email_unique_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE UNIQUE INDEX "user_profiles_email_unique_idx" ON "app_private"."user_profiles" USING "btree" ("lower"("email")) WHERE ("email" IS NOT NULL);


--
-- Name: user_role_assignments_role_uid_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX "user_role_assignments_role_uid_idx" ON "app_private"."user_role_assignments" USING "btree" ("role_code", "uid");


--
-- Name: system_setup apply_announcement_comment_setting; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "apply_announcement_comment_setting" AFTER UPDATE OF "announcement_comments_enabled" ON "app_private"."system_setup" FOR EACH ROW WHEN (("old"."announcement_comments_enabled" IS DISTINCT FROM "new"."announcement_comments_enabled")) EXECUTE FUNCTION "app_private"."apply_announcement_comment_setting"();


--
-- Name: announcement_comments attach_announcement_comment_markdown_uploads; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "attach_announcement_comment_markdown_uploads" AFTER INSERT OR UPDATE OF "content" ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."attach_markdown_uploads_from_content"();


--
-- Name: announcements attach_announcement_markdown_uploads; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "attach_announcement_markdown_uploads" AFTER INSERT OR UPDATE OF "content" ON "app_private"."announcements" FOR EACH ROW EXECUTE FUNCTION "app_private"."attach_markdown_uploads_from_content"();


--
-- Name: comments attach_comment_markdown_uploads; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "attach_comment_markdown_uploads" AFTER INSERT OR UPDATE OF "content" ON "app_private"."comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."attach_markdown_uploads_from_content"();


--
-- Name: facility_reports attach_facility_markdown_uploads; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "attach_facility_markdown_uploads" AFTER INSERT OR UPDATE OF "content" ON "app_private"."facility_reports" FOR EACH ROW EXECUTE FUNCTION "app_private"."attach_markdown_uploads_from_content"();


--
-- Name: issues attach_issue_markdown_uploads; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "attach_issue_markdown_uploads" AFTER INSERT OR UPDATE OF "content" ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."attach_markdown_uploads_from_content"();


--
-- Name: notifications broadcast_notification_insert; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "broadcast_notification_insert" AFTER INSERT ON "app_private"."notifications" FOR EACH ROW EXECUTE FUNCTION "app_private"."broadcast_notification_insert"();


--
-- Name: notification_states broadcast_notification_state_change; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "broadcast_notification_state_change" AFTER INSERT OR UPDATE ON "app_private"."notification_states" FOR EACH ROW EXECUTE FUNCTION "app_private"."broadcast_notification_state_change"();


--
-- Name: announcement_comments bump_announcement_comment_content_version; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "bump_announcement_comment_content_version" BEFORE INSERT OR DELETE OR UPDATE ON "app_private"."announcement_comments" FOR EACH STATEMENT EXECUTE FUNCTION "app_private"."bump_content_version"('announcements');


--
-- Name: announcements bump_announcement_content_version; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "bump_announcement_content_version" BEFORE INSERT OR DELETE OR UPDATE ON "app_private"."announcements" FOR EACH STATEMENT EXECUTE FUNCTION "app_private"."bump_content_version"('announcements');


--
-- Name: facility_reports bump_facility_content_version; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "bump_facility_content_version" BEFORE INSERT OR DELETE OR UPDATE ON "app_private"."facility_reports" FOR EACH STATEMENT EXECUTE FUNCTION "app_private"."bump_content_version"('facilities');


--
-- Name: comments bump_issue_comment_content_version; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "bump_issue_comment_content_version" BEFORE INSERT OR DELETE OR UPDATE ON "app_private"."comments" FOR EACH STATEMENT EXECUTE FUNCTION "app_private"."bump_content_version"('issues');


--
-- Name: issues bump_issue_content_version; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "bump_issue_content_version" BEFORE INSERT OR DELETE OR UPDATE ON "app_private"."issues" FOR EACH STATEMENT EXECUTE FUNCTION "app_private"."bump_content_version"('issues');


--
-- Name: announcement_comments cleanup_announcement_comment_markdown_uploads; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "cleanup_announcement_comment_markdown_uploads" AFTER DELETE ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_deleted_content_uploads"();


--
-- Name: announcements cleanup_announcement_markdown_uploads; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "cleanup_announcement_markdown_uploads" AFTER DELETE ON "app_private"."announcements" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_deleted_content_uploads"();


--
-- Name: comments cleanup_comment_markdown_uploads; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "cleanup_comment_markdown_uploads" AFTER DELETE ON "app_private"."comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_deleted_content_uploads"();


--
-- Name: issues cleanup_issue_markdown_uploads; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "cleanup_issue_markdown_uploads" AFTER DELETE ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_deleted_content_uploads"();


--
-- Name: issue_categories close_issue_comments_with_category; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "close_issue_comments_with_category" AFTER UPDATE OF "comments_enabled" ON "app_private"."issue_categories" FOR EACH ROW EXECUTE FUNCTION "app_private"."close_issue_comments_with_category"();


--
-- Name: announcements enforce_announcement_comment_availability; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "enforce_announcement_comment_availability" BEFORE INSERT OR UPDATE OF "comments_enabled" ON "app_private"."announcements" FOR EACH ROW EXECUTE FUNCTION "app_private"."enforce_announcement_comment_availability"();


--
-- Name: announcement_comments enforce_announcement_comment_input_limits; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "enforce_announcement_comment_input_limits" BEFORE INSERT OR UPDATE OF "content" ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."enforce_entry_input_limits"();


--
-- Name: announcements enforce_announcement_input_limits; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "enforce_announcement_input_limits" BEFORE INSERT OR UPDATE OF "title", "content" ON "app_private"."announcements" FOR EACH ROW EXECUTE FUNCTION "app_private"."enforce_entry_input_limits"();


--
-- Name: comments enforce_comment_input_limits; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "enforce_comment_input_limits" BEFORE INSERT OR UPDATE OF "content" ON "app_private"."comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."enforce_entry_input_limits"();


--
-- Name: issues enforce_issue_comment_availability; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "enforce_issue_comment_availability" BEFORE INSERT OR UPDATE OF "category", "status" ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."enforce_issue_comment_availability"();


--
-- Name: issues enforce_issue_input_limits; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "enforce_issue_input_limits" BEFORE INSERT OR UPDATE OF "title", "content" ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."enforce_entry_input_limits"();


--
-- Name: announcement_comments prevent_announcement_comment_when_disabled; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "prevent_announcement_comment_when_disabled" BEFORE INSERT ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."prevent_announcement_comment_when_disabled"();


--
-- Name: comments prevent_comment_when_disabled; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "prevent_comment_when_disabled" BEFORE INSERT ON "app_private"."comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."prevent_comment_when_disabled"();


--
-- Name: issue_categories prevent_issue_category_identity_change; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "prevent_issue_category_identity_change" BEFORE UPDATE ON "app_private"."issue_categories" FOR EACH ROW EXECUTE FUNCTION "app_private"."prevent_issue_category_identity_change"();


--
-- Name: issues prevent_issue_policy_snapshot_change; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "prevent_issue_policy_snapshot_change" BEFORE UPDATE ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."prevent_issue_policy_snapshot_change"();


--
-- Name: announcement_comments queue_announcement_comment_created_outbox; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_announcement_comment_created_outbox" AFTER INSERT ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_announcement_comment_created"();


--
-- Name: announcement_comments queue_announcement_comment_realtime_on_delete; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_announcement_comment_realtime_on_delete" AFTER DELETE ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_announcement_comment_realtime_event"();


--
-- Name: announcement_comments queue_announcement_comment_realtime_on_insert; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_announcement_comment_realtime_on_insert" AFTER INSERT ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_announcement_comment_realtime_event"();


--
-- Name: announcement_comments queue_announcement_comment_realtime_on_update; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_announcement_comment_realtime_on_update" AFTER UPDATE ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_announcement_comment_realtime_event"();


--
-- Name: announcements queue_announcement_created_outbox; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_announcement_created_outbox" AFTER INSERT ON "app_private"."announcements" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_announcement_change"();


--
-- Name: announcements queue_announcement_deleted_outbox; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_announcement_deleted_outbox" AFTER DELETE ON "app_private"."announcements" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_announcement_change"();


--
-- Name: announcements queue_announcement_realtime_on_delete; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_announcement_realtime_on_delete" AFTER DELETE ON "app_private"."announcements" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_announcement_realtime_event"();


--
-- Name: announcements queue_announcement_realtime_on_insert; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_announcement_realtime_on_insert" AFTER INSERT ON "app_private"."announcements" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_announcement_realtime_event"();


--
-- Name: announcements queue_announcement_realtime_on_update; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_announcement_realtime_on_update" AFTER UPDATE ON "app_private"."announcements" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_announcement_realtime_event"();


--
-- Name: announcements queue_announcement_updated_outbox; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_announcement_updated_outbox" AFTER UPDATE OF "title", "content" ON "app_private"."announcements" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_announcement_change"();


--
-- Name: comments queue_comment_created_outbox; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_comment_created_outbox" AFTER INSERT ON "app_private"."comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_comment_created"();


--
-- Name: facility_reports queue_deleted_facility_uploads; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_deleted_facility_uploads" BEFORE DELETE ON "app_private"."facility_reports" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_deleted_content_uploads"();


--
-- Name: facility_reports queue_facility_realtime_event; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_facility_realtime_event" AFTER INSERT OR DELETE OR UPDATE ON "app_private"."facility_reports" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_facility_realtime_event"();


--
-- Name: issues queue_issue_change_outbox; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_issue_change_outbox" AFTER INSERT OR UPDATE OF "status" ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_issue_change"();


--
-- Name: comments queue_issue_comment_realtime_on_delete; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_issue_comment_realtime_on_delete" AFTER DELETE ON "app_private"."comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_issue_comment_realtime_event"();


--
-- Name: comments queue_issue_comment_realtime_on_insert; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_issue_comment_realtime_on_insert" AFTER INSERT ON "app_private"."comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_issue_comment_realtime_event"();


--
-- Name: comments queue_issue_comment_realtime_on_update; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_issue_comment_realtime_on_update" AFTER UPDATE ON "app_private"."comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_issue_comment_realtime_event"();


--
-- Name: issues queue_issue_realtime_on_delete; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_issue_realtime_on_delete" AFTER DELETE ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_issue_realtime_event"();


--
-- Name: issues queue_issue_realtime_on_insert; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_issue_realtime_on_insert" AFTER INSERT ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_issue_realtime_event"();


--
-- Name: issues queue_issue_realtime_on_update; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "queue_issue_realtime_on_update" AFTER UPDATE ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."queue_issue_realtime_event"();


--
-- Name: announcement_comments refresh_announcement_comment_count_on_delete; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "refresh_announcement_comment_count_on_delete" AFTER DELETE ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_announcement_comment_count"();


--
-- Name: announcement_comments refresh_announcement_comment_count_on_insert; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "refresh_announcement_comment_count_on_insert" AFTER INSERT ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_announcement_comment_count"();


--
-- Name: announcement_likes refresh_announcement_like_count_on_delete; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "refresh_announcement_like_count_on_delete" AFTER DELETE ON "app_private"."announcement_likes" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_announcement_like_count"();


--
-- Name: announcement_likes refresh_announcement_like_count_on_insert; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "refresh_announcement_like_count_on_insert" AFTER INSERT ON "app_private"."announcement_likes" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_announcement_like_count"();


--
-- Name: supports refresh_issue_support_count_on_delete; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "refresh_issue_support_count_on_delete" AFTER DELETE ON "app_private"."supports" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_issue_support_count"();


--
-- Name: supports refresh_issue_support_count_on_insert; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "refresh_issue_support_count_on_insert" AFTER INSERT ON "app_private"."supports" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_issue_support_count"();


--
-- Name: issues set_issue_closed_at_on_status_change; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "set_issue_closed_at_on_status_change" BEFORE INSERT OR UPDATE OF "status" ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."set_issue_closed_at"();


--
-- Name: issues set_issue_derived_fields_on_write; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "set_issue_derived_fields_on_write" BEFORE INSERT OR UPDATE OF "title", "support_count", "support_goal" ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."set_issue_derived_fields"();


--
-- Name: deletion_jobs skip_duplicate_active_deletion_job; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "skip_duplicate_active_deletion_job" BEFORE INSERT ON "app_private"."deletion_jobs" FOR EACH ROW EXECUTE FUNCTION "app_private"."skip_duplicate_active_deletion_job"();


--
-- Name: outbox_events skip_identical_outbox_update; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "skip_identical_outbox_update" BEFORE UPDATE ON "app_private"."outbox_events" FOR EACH ROW EXECUTE FUNCTION "app_private"."skip_identical_outbox_update"();


--
-- Name: issues snapshot_issue_category_defaults; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "snapshot_issue_category_defaults" BEFORE INSERT ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."snapshot_issue_category_defaults"();


--
-- Name: facility_categories touch_facility_category; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "touch_facility_category" BEFORE UPDATE ON "app_private"."facility_categories" FOR EACH ROW EXECUTE FUNCTION "app_private"."touch_facility_category"();


--
-- Name: announcement_comments touch_platform_activity_announcement_comments; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "touch_platform_activity_announcement_comments" AFTER INSERT ON "app_private"."announcement_comments" FOR EACH STATEMENT EXECUTE FUNCTION "app_private"."touch_platform_activity"();


--
-- Name: announcements touch_platform_activity_announcements; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "touch_platform_activity_announcements" AFTER INSERT OR UPDATE ON "app_private"."announcements" FOR EACH STATEMENT EXECUTE FUNCTION "app_private"."touch_platform_activity"();


--
-- Name: comments touch_platform_activity_comments; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "touch_platform_activity_comments" AFTER INSERT ON "app_private"."comments" FOR EACH STATEMENT EXECUTE FUNCTION "app_private"."touch_platform_activity"();


--
-- Name: issues touch_platform_activity_issues; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "touch_platform_activity_issues" AFTER INSERT OR UPDATE ON "app_private"."issues" FOR EACH STATEMENT EXECUTE FUNCTION "app_private"."touch_platform_activity"();


--
-- Name: announcement_comments track_announcement_comment_counters; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "track_announcement_comment_counters" AFTER INSERT OR DELETE ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."track_platform_row_change"();


--
-- Name: comments track_comment_category_counter; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "track_comment_category_counter" AFTER INSERT OR DELETE OR UPDATE OF "issue_id" ON "app_private"."comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."track_comment_category_counter"();


--
-- Name: comments track_comment_counters; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "track_comment_counters" AFTER INSERT OR DELETE ON "app_private"."comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."track_platform_row_change"();


--
-- Name: issues track_issue_category_counter; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "track_issue_category_counter" BEFORE INSERT OR DELETE OR UPDATE OF "category" ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."track_issue_category_counter"();


--
-- Name: issues track_issue_counters; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "track_issue_counters" AFTER INSERT OR DELETE ON "app_private"."issues" FOR EACH ROW EXECUTE FUNCTION "app_private"."track_platform_row_change"();


--
-- Name: supports track_support_counters; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "track_support_counters" AFTER INSERT OR DELETE ON "app_private"."supports" FOR EACH ROW EXECUTE FUNCTION "app_private"."track_platform_row_change"();


--
-- Name: user_profiles track_user_seen_counter; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "track_user_seen_counter" AFTER INSERT ON "app_private"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "app_private"."track_user_seen_counter"();


--
-- Name: announcement_comments validate_announcement_comment_parent; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "validate_announcement_comment_parent" BEFORE INSERT OR UPDATE OF "parent_comment_id", "announcement_id" ON "app_private"."announcement_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."validate_announcement_comment_parent"();


--
-- Name: comments validate_comment_parent; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "validate_comment_parent" BEFORE INSERT OR UPDATE OF "parent_comment_id", "issue_id" ON "app_private"."comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."validate_comment_parent"();


--
-- Name: user_profiles version_user_public_profile; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER "version_user_public_profile" BEFORE UPDATE ON "app_private"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "app_private"."version_user_public_profile"();


--
-- Name: announcement_comments announcement_comments_announcement_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."announcement_comments"
    ADD CONSTRAINT "announcement_comments_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "app_private"."announcements"("id") ON DELETE CASCADE;


--
-- Name: announcement_comments announcement_comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."announcement_comments"
    ADD CONSTRAINT "announcement_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "app_private"."announcement_comments"("id") ON DELETE CASCADE;


--
-- Name: announcement_likes announcement_likes_announcement_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."announcement_likes"
    ADD CONSTRAINT "announcement_likes_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "app_private"."announcements"("id") ON DELETE CASCADE;


--
-- Name: comments comments_issue_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."comments"
    ADD CONSTRAINT "comments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "app_private"."issues"("id") ON DELETE CASCADE;


--
-- Name: comments comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."comments"
    ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "app_private"."comments"("id") ON DELETE CASCADE;


--
-- Name: facility_report_affected_users facility_report_affected_users_facility_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."facility_report_affected_users"
    ADD CONSTRAINT "facility_report_affected_users_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "app_private"."facility_reports"("id") ON DELETE CASCADE;


--
-- Name: facility_reports facility_reports_category_runtime_fk; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."facility_reports"
    ADD CONSTRAINT "facility_reports_category_runtime_fk" FOREIGN KEY ("category_id") REFERENCES "app_private"."facility_categories"("id") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: issues issues_category_runtime_fk; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."issues"
    ADD CONSTRAINT "issues_category_runtime_fk" FOREIGN KEY ("category") REFERENCES "app_private"."issue_categories"("id") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_permission_code_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "app_private"."permissions"("code") ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_code_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "app_private"."roles"("code") ON DELETE CASCADE;


--
-- Name: supports supports_issue_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."supports"
    ADD CONSTRAINT "supports_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "app_private"."issues"("id") ON DELETE CASCADE;


--
-- Name: user_facility_category_assignments user_facility_category_assignments_category_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."user_facility_category_assignments"
    ADD CONSTRAINT "user_facility_category_assignments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "app_private"."facility_categories"("id") ON DELETE CASCADE;


--
-- Name: user_issue_category_assignments user_issue_category_assignments_category_runtime_fk; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."user_issue_category_assignments"
    ADD CONSTRAINT "user_issue_category_assignments_category_runtime_fk" FOREIGN KEY ("category_id") REFERENCES "app_private"."issue_categories"("id") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_role_assignments user_role_assignments_role_code_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY "app_private"."user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "app_private"."roles"("code") ON DELETE CASCADE;


--
-- Name: access_assignment_audit; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."access_assignment_audit" ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_comments; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."announcement_comments" ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_likes; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."announcement_likes" ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."announcements" ENABLE ROW LEVEL SECURITY;

--
-- Name: category_configuration_audit; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."category_configuration_audit" ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."comments" ENABLE ROW LEVEL SECURITY;

--
-- Name: content_versions; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."content_versions" ENABLE ROW LEVEL SECURITY;

--
-- Name: deletion_jobs; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."deletion_jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: facility_categories; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."facility_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: facility_report_affected_users; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."facility_report_affected_users" ENABLE ROW LEVEL SECURITY;

--
-- Name: facility_reports; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."facility_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: idempotency_keys; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."idempotency_keys" ENABLE ROW LEVEL SECURITY;

--
-- Name: issue_categories; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."issue_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: issues; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."issues" ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_runs; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."maintenance_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_states; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."notification_states" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: notion_pages; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."notion_pages" ENABLE ROW LEVEL SECURITY;

--
-- Name: outbox_events; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."outbox_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_category_counters; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."platform_category_counters" ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_counters; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."platform_counters" ENABLE ROW LEVEL SECURITY;

--
-- Name: push_delivery_logs; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."push_delivery_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."push_tokens" ENABLE ROW LEVEL SECURITY;

--
-- Name: realtime_events; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."realtime_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: role_assignment_audit; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."role_assignment_audit" ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."role_permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: runtime_settings; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."runtime_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: supports; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."supports" ENABLE ROW LEVEL SECURITY;

--
-- Name: system_setup; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."system_setup" ENABLE ROW LEVEL SECURITY;

--
-- Name: uploads; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."uploads" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_facility_category_assignments; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."user_facility_category_assignments" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_issue_category_assignments; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."user_issue_category_assignments" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."user_profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_role_assignments; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."user_role_assignments" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: app_private; Owner: -
--

ALTER TABLE "app_private"."user_roles" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--
