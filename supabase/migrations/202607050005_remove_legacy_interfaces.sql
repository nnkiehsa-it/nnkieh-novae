-- Remove API objects retained from the pre-Edge-Function data path.
drop view if exists app_api.issues;
drop view if exists app_api.notifications;
drop view if exists app_api.notification_states;
drop function if exists app_api.delete_issue(uuid);
