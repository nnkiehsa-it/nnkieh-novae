drop function app_api.backend_list_admin_users(text,integer);
create function app_api.backend_list_admin_users(search_query text default '',page_limit integer default 80,page_offset integer default 0)
returns jsonb language sql stable security definer set search_path to 'app_private','public' as $$
with rows as (
 select p.*,r.restricted_until,coalesce(r.restricted_permanently,false) restricted_permanently,
 coalesce(r.reason,'') restriction_reason
 from app_private.user_profiles p left join app_private.user_restrictions r on r.uid=p.uid
 where search_query='' or p.uid ilike '%'||search_query||'%' or p.email ilike '%'||search_query||'%'
 or p.display_name ilike '%'||search_query||'%'
 order by p.uid limit least(greatest(page_limit,1),100)+1 offset greatest(page_offset,0)
), limited as (select * from rows order by uid limit least(greatest(page_limit,1),100))
select jsonb_build_object('truncated',(select count(*) from rows)>least(greatest(page_limit,1),100),
 'users',coalesce((select jsonb_agg(jsonb_build_object(
 'uid',p.uid,'email',p.email,'name',coalesce(nullif(p.display_name,''),p.email,p.uid),
 'createdAt',p.created_at,'lastSeenAt',p.last_seen_at,'restrictedUntil',p.restricted_until,
 'restrictedPermanently',p.restricted_permanently,'restrictionReason',p.restriction_reason,
 'roles',coalesce((select jsonb_agg(role_code order by role_code) from app_private.user_role_assignments where uid=p.uid),'[]'),
 'managedIssueCategoryIds',coalesce((select jsonb_agg(category_id order by category_id) from app_private.user_issue_category_assignments where uid=p.uid),'[]'),
 'managedFacilityCategoryIds',coalesce((select jsonb_agg(category_id order by category_id) from app_private.user_facility_category_assignments where uid=p.uid),'[]')
 ) order by uid) from limited p),'[]'));
$$;
drop function app_api.backend_list_admin_audit(text,integer);
create function app_api.backend_list_admin_audit(search_query text default '',page_limit integer default 100,page_offset integer default 0)
returns jsonb language sql stable security definer set search_path to 'app_private','public' as $$
with rows as (
 select a.id,a.actor_uid,coalesce(p.display_name,p.email,a.actor_uid) actor_name,a.action,a.domain,a.target_id,a.detail,a.created_at
 from app_private.admin_audit_log a left join app_private.user_profiles p on p.uid=a.actor_uid
 where search_query='' or a.actor_uid ilike '%'||search_query||'%' or p.display_name ilike '%'||search_query||'%'
 or a.action ilike '%'||search_query||'%' or a.domain ilike '%'||search_query||'%' or a.target_id ilike '%'||search_query||'%'
 order by a.id desc limit least(greatest(page_limit,1),100)+1 offset greatest(page_offset,0)
), limited as (select * from rows order by id desc limit least(greatest(page_limit,1),100))
select jsonb_build_object('truncated',(select count(*) from rows)>least(greatest(page_limit,1),100),
 'entries',coalesce((select jsonb_agg(to_jsonb(limited) order by id desc) from limited),'[]'));
$$;
revoke all on function app_api.backend_list_admin_users(text,integer,integer) from public;
revoke all on function app_api.backend_list_admin_audit(text,integer,integer) from public;
grant execute on function app_api.backend_list_admin_users(text,integer,integer) to novae_runtime;
grant execute on function app_api.backend_list_admin_audit(text,integer,integer) to novae_runtime;

