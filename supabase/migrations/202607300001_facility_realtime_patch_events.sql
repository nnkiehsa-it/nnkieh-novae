create or replace function app_private.queue_facility_realtime_event()
returns trigger
language plpgsql
security definer
set search_path = app_private, realtime, public
as $$
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

revoke all on function app_private.queue_facility_realtime_event() from public, anon, authenticated;

drop trigger if exists queue_facility_realtime_event on app_private.facility_reports;
create trigger queue_facility_realtime_event
after insert or update or delete on app_private.facility_reports
for each row execute function app_private.queue_facility_realtime_event();
