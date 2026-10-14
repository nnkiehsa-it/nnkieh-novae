export type { IssueStatus, IssueStatusBucket, IssueSort as IssueSortOption, IssueCursor } from '@shared/contracts/issues.ts';
export type IssueCategory = string;
export type IssueFilter = IssueCategory;
export type IssueRouteFilter = IssueFilter | 'my-proposals';
export type { NotificationSource, NotificationTargetType, NotificationType } from '@shared/contracts/notifications.ts';


export type IssueSummary = import('@shared/contracts/issues.ts').IssueSummary;
/** A proposal's page; whether the reader may delete it is known once the page has been read. */
export type IssueRecord = import('@shared/contracts/issues.ts').Issue & { canDeleteIssue?: boolean };

interface OperationTimeListItem {
  label: string;
  shortLabel: string;
  valueLabel: string;
}

export interface IssueOperationTimeItem extends OperationTimeListItem {
  value: Date;
}

export type { Comment, CommentCursor, CommentSort as CommentSortOption } from '@shared/contracts/discussions.ts';

export type { FacilityCursor, FacilityStatus, FacilitySort as FacilitySortOption } from '@shared/contracts/facilities.ts';
export type FacilitySummary = import('@shared/contracts/facilities.ts').FacilitySummary;
export type FacilityRecord = import('@shared/contracts/facilities.ts').Facility;
export type FacilityInput = import('@shared/actions.ts').ActionRequest<'createFacility'>;
export type FacilityPageResult = import('@shared/actions.ts').ActionOutput<'listFacilities'>;

export type NotificationRecord = import('@shared/contracts/notifications.ts').Notification;

export type AnnouncementSummary = import('@shared/contracts/announcements.ts').AnnouncementSummary;
export type AnnouncementRecord = import('@shared/contracts/announcements.ts').Announcement;

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
