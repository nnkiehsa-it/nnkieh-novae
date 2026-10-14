import type { IssueReadAccess } from './categories';

export type IssueStatus =
  | 'under-review'
  | 'pending'
  | 'processing'
  | 'auto-rejected'
  | 'review-rejected'
  | 'infeasible'
  | 'completed';
export type IssueStatusBucket = 'active' | 'closed';
export type IssueCategory = string;
export type WritableIssueCategory = IssueCategory;
export type IssueFilter = IssueCategory;
export type IssueRouteFilter = IssueFilter | 'my-proposals';
export type IssueSortOption = 'latest' | 'most-supported' | 'ending-soon';
export type { NotificationSource, NotificationTargetType, NotificationType } from '@shared/contracts/notifications.ts';


export interface IssueSummary {
  id: string;
  title: string;
  created_at: Date | null;
  closed_at: Date | null;
  support_count: number;
  status: IssueStatus;
  category: IssueCategory;
  read_access: IssueReadAccess;
  comments_enabled: boolean;
  support_enabled: boolean;
  support_goal: number | null;
  support_deadline_at: Date | null;
  review_approved_at: Date | null;
  result_content?: string;
  support_met_at: Date | null;
  review_rejection_reason?: string;
  currentUserSupported?: boolean;
  isOwnIssue: boolean;
  canDeleteIssue: boolean;
  canManageIssue: boolean;
  canViewAuthor: boolean;
  deleting?: boolean;
  author_uid: string | null;
}

export interface IssueRecord extends IssueSummary {
  content: string;
}

interface OperationTimeListItem {
  label: string;
  shortLabel: string;
  valueLabel: string;
}

export interface IssueOperationTimeItem extends OperationTimeListItem {
  value: Date;
}

export interface IssueCursor {
  id: string;
  created_at: Date | null;
  sort_date?: Date | null;
  sort_number?: number | null;
}

export interface DiscussionCommentRecord {
  id: string;
  content: string;
  parent_comment_id: string | null;
  author_uid: string;
  created_at: Date | null;
  replies: DiscussionCommentRecord[];
}

export type CommentSortOption = 'newest' | 'oldest';

export interface CommentRecord extends DiscussionCommentRecord {
  issue_id: string;
}

export interface ComposerInput {
  title: string;
  content: string;
  category: WritableIssueCategory;
}

export type { FacilityCursor, FacilityStatus, FacilitySort as FacilitySortOption } from '@shared/contracts/facilities.ts';
/** A list entry; `deleting` marks one this tab is removing. */
export type FacilitySummary = import('@shared/contracts/facilities.ts').FacilitySummary & { deleting?: boolean };
export type FacilityRecord = import('@shared/contracts/facilities.ts').Facility & { deleting?: boolean };
export type FacilityInput = import('@shared/actions.ts').ActionRequest<'createFacility'>;
export type FacilityPageResult = import('@shared/actions.ts').ActionOutput<'listFacilities'>;

export interface CommentInput {
  content: string;
}

export type CategoryCountMap = Record<IssueCategory, number> & Record<string, number>;

export interface PlatformDashboardStats {
  total_users_seen: number;
  total_issues_created: number;
  total_comments_created: number;
  total_supports_added: number;
  total_supports_removed: number;
  total_issues_deleted: number;
  total_comments_deleted: number;
  issues_by_category: CategoryCountMap;
  comments_by_category: CategoryCountMap;
  last_activity_at: Date | null;
  updated_at: Date | null;
}

type PlatformDashboardStatus = 'healthy' | 'attention' | 'critical';

interface PlatformDashboardFailure {
  id: string;
  source: 'delivery' | 'push' | 'cleanup' | string;
  status: string;
  failure_id: string;
  detail_type: string;
  target_type: string;
  target_id: string;
  attempt_count: number;
  next_attempt_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
}

interface PlatformDashboardScheduledMaintenance {
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  updated_at: Date | null;
  failed_task_codes: string[];
  failure_id: string;
}

export interface PlatformDashboardOperations {
  overall_status: PlatformDashboardStatus;
  pending_notion_sync_count: number;
  pending_notion_sync_capped: boolean;
  next_sync_count: number;
  failed_notion_sync_count: number;
  failed_notion_sync_capped: boolean;
  oldest_pending_sync_at: Date | null;
  failed_delivery_count: number;
  failed_delivery_capped: boolean;
  failed_push_delivery_count: number;
  failed_push_delivery_capped: boolean;
  stuck_upload_count: number;
  stuck_upload_capped: boolean;
  cleanup_backlog_count: number;
  cleanup_backlog_capped: boolean;
  scheduled_maintenance: PlatformDashboardScheduledMaintenance;
  recent_failures: PlatformDashboardFailure[];
}

export interface PlatformDashboardData {
  stats: PlatformDashboardStats;
  operations: PlatformDashboardOperations;
}

export type NotificationRecord = import('@shared/contracts/notifications.ts').Notification;

export interface AnnouncementSummary {
  id: string;
  title: string;
  author_uid: string;
  published_at: Date | null;
  like_count: number;
  comment_count: number;
  comments_enabled: boolean;
  currentUserLiked: boolean;
  deleting?: boolean;
}

export interface AnnouncementRecord extends AnnouncementSummary {
  content: string;
}

export interface AnnouncementCommentRecord extends DiscussionCommentRecord {
  announcement_id: string;
}

export interface AnnouncementInput {
  title: string;
  content: string;
}

export type { UserPublicProfile } from '@shared/contracts/users.ts';

export interface MarkdownImageRecord {
  src: string;
  alt: string;
  fullSrc?: string;
  uploadId?: string;
  isUploadResolved?: boolean;
  resolveError?: string;
  width?: number;
  height?: number;
}
