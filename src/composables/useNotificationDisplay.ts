import type { AppIconName } from '@/components/ui/atoms/AppIcon.vue';
import { FACILITY_STATUS_LABELS, ISSUE_STATUS_LABELS } from '@/constants/statuses';
import { useI18n } from '@/i18n';
import type { NotificationRecord } from '@/types';

const LEGACY_STATUS_SUFFIX =
  /\s+(?:\u73fe\u5728\u72c0\u614b\u70ba\s+.+|\u5df2\u901a\u904e\u5be9\u6838\u4e26\u958b\u653e\u9644\u8b70\u3002)$/u;

export function useNotificationDisplay() {
  const { t } = useI18n();

  function isComment(notification: NotificationRecord) {
    return notification.type === 'announcement_comment_created'
      || notification.type === 'issue_comment_created';
  }

  function title(notification: NotificationRecord) {
    if (isComment(notification)) {
      return t('notification.commentTitle', {
        name: notification.actor_name?.trim() || t('navigation.user'),
      });
    }
    if (notification.type === 'announcement_created') return t('notification.announcementCreated');
    if (notification.type === 'facility_status_changed') return t('notification.facilityStatusChanged');
    if (notification.type === 'facility_report_created') return t('notification.facilityReportCreated');
    if (notification.type === 'support_goal_met') return t('notification.supportGoalMet');
    if (notification.type === 'issue_deleted') return t('notification.issueDeleted');
    if (
      notification.type === 'issue_status_changed'
      && notification.old_status === 'under-review'
      && notification.new_status === 'pending'
    ) {
      return t('notification.issueReviewApproved');
    }
    if (notification.type === 'issue_status_changed') return t('notification.issueStatusChanged');
    return t(notification.title);
  }

  function body(notification: NotificationRecord) {
    const rawBody = notification.body_preview?.trim() ?? '';
    if (isComment(notification) || !rawBody) return rawBody;
    if (notification.type !== 'facility_status_changed' && notification.type !== 'issue_status_changed') {
      return rawBody;
    }

    const targetTitle = rawBody.replace(LEGACY_STATUS_SUFFIX, '');
    if (
      notification.type === 'issue_status_changed'
      && notification.old_status === 'under-review'
      && notification.new_status === 'pending'
    ) {
      return t('notification.issueReviewApprovedBody', { title: targetTitle });
    }

    const statusKey = notification.new_status
      ? notification.type === 'facility_status_changed'
        ? FACILITY_STATUS_LABELS[notification.new_status as keyof typeof FACILITY_STATUS_LABELS]
        : ISSUE_STATUS_LABELS[notification.new_status as keyof typeof ISSUE_STATUS_LABELS]
      : undefined;
    return statusKey
      ? t('notification.statusChangedBody', { title: targetTitle, status: t(statusKey) })
      : targetTitle;
  }

  function icon(notification: NotificationRecord): AppIconName {
    if (notification.type === 'announcement_created') return 'megaphone';
    if (notification.type === 'facility_status_changed' || notification.type === 'facility_report_created') return 'wrench';
    if (notification.type === 'support_goal_met') return 'check-circle';
    if (notification.type === 'issue_deleted') return 'trash';
    return 'switch-horizontal';
  }

  function iconClass(notification: NotificationRecord) {
    if (notification.type === 'announcement_created') return 'bg-info-container text-on-info-container';
    if (notification.type === 'support_goal_met') return 'bg-success-container text-on-success-container';
    if (notification.type === 'issue_deleted') return 'bg-error-container text-on-error-container';
    if (
      notification.type === 'issue_status_changed'
      && ['infeasible', 'auto-rejected', 'review-rejected'].includes(notification.new_status ?? '')
    ) {
      return notification.new_status === 'infeasible'
        ? 'bg-infeasible-container text-on-infeasible-container'
        : 'bg-error-container text-on-error-container';
    }
    return 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300';
  }

  return {
    body,
    icon,
    iconClass,
    isComment,
    title,
  };
}
