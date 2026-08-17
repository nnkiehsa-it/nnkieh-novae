import { describe, expect, it } from 'vitest';
import {
  canManageFacilityCategory,
  canManageIssueCategory,
  hasPermission,
  hasRole,
  type SessionAccessPolicy,
} from '@/lib/session-access';

const emptyAccess: SessionAccessPolicy = {
  managedFacilityCategoryIds: [],
  managedIssueCategoryIds: [],
  permissions: [],
  roles: [],
};

describe('session access policy matrix', () => {
  const cases: Array<{
    access: SessionAccessPolicy;
    announcement: boolean;
    facilityA: boolean;
    facilityB: boolean;
    issueA: boolean;
    issueB: boolean;
    name: string;
    platformAdmin: boolean;
  }> = [
    {
      access: emptyAccess,
      announcement: false,
      facilityA: false,
      facilityB: false,
      issueA: false,
      issueB: false,
      name: 'ordinary user',
      platformAdmin: false,
    },
    {
      access: {
        ...emptyAccess,
        managedIssueCategoryIds: ['issue-a'],
        permissions: ['proposal.manage'],
        roles: ['proposal-manager'],
      },
      announcement: false,
      facilityA: false,
      facilityB: false,
      issueA: true,
      issueB: false,
      name: 'proposal manager in one category',
      platformAdmin: false,
    },
    {
      access: {
        ...emptyAccess,
        managedFacilityCategoryIds: ['facility-a'],
        permissions: ['facility.manage'],
        roles: ['general-affairs'],
      },
      announcement: false,
      facilityA: true,
      facilityB: false,
      issueA: false,
      issueB: false,
      name: 'facility manager in one category',
      platformAdmin: false,
    },
    {
      access: {
        ...emptyAccess,
        permissions: ['announcement.manage'],
        roles: ['announcement-manager'],
      },
      announcement: true,
      facilityA: false,
      facilityB: false,
      issueA: false,
      issueB: false,
      name: 'announcement manager',
      platformAdmin: false,
    },
    {
      access: {
        ...emptyAccess,
        permissions: [
          'announcement.manage',
          'category.manage',
          'dashboard.view',
          'facility.manage',
          'proposal.manage',
          'role.manage',
        ],
        roles: ['platform-admin'],
      },
      announcement: true,
      facilityA: true,
      facilityB: true,
      issueA: true,
      issueB: true,
      name: 'platform administrator',
      platformAdmin: true,
    },
  ];

  it.each(cases)('$name receives only its expected global and category scopes', ({
    access,
    announcement,
    facilityA,
    facilityB,
    issueA,
    issueB,
    platformAdmin,
  }) => {
    expect(hasRole(access, 'platform-admin')).toBe(platformAdmin);
    expect(hasPermission(access, 'announcement.manage')).toBe(announcement);
    expect(canManageIssueCategory(access, 'issue-a')).toBe(issueA);
    expect(canManageIssueCategory(access, 'issue-b')).toBe(issueB);
    expect(canManageFacilityCategory(access, 'facility-a')).toBe(facilityA);
    expect(canManageFacilityCategory(access, 'facility-b')).toBe(facilityB);
  });
});
