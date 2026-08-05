import { shallowMount, type VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DetailActionButton from '@/components/ui/molecules/DetailActionButton.vue';
import DetailActionGroup from '@/components/ui/molecules/DetailActionGroup.vue';
import FacilityDetailActions from '@/components/FacilityDetailActions.vue';
import IconListRow from '@/components/ui/molecules/IconListRow.vue';
import IssueDetailSupportFooter from '@/components/IssueDetailSupportFooter.vue';
import SettingsPanelContent from '@/components/SettingsPanelContent.vue';
import { setLocale } from '@/i18n';
import type { FacilityRecord, IssueRecord } from '@/types';

const categoryState = vi.hoisted(() => ({ issuesEnabled: true }));
vi.mock('@/composables/useCategories', async () => {
  const { computed } = await import('vue');
  return {
    useCategories: () => ({
      issuesEnabled: computed(() => categoryState.issuesEnabled),
    }),
  };
});
const detailActionGroupStub = {
  name: 'DetailActionGroup',
  props: {
    showDelete: {
      default: false,
      type: Boolean,
    },
  },
  emits: ['delete', 'share'],
  template: '<div><slot name="header" /><slot name="primary" /><slot /></div>',
};
const passthroughStub = {
  template: '<div><slot /></div>',
};

function issueFixture(overrides: Partial<IssueRecord> = {}): IssueRecord {
  return {
    author_uid: 'owner',
    canManageIssue: false,
    canViewAuthor: true,
    category: 'issue-a',
    closed_at: null,
    comments_enabled: true,
    content: 'Content',
    created_at: new Date('2026-01-01T00:00:00Z'),
    id: 'issue-1',
    isOwnIssue: false,
    read_access: 'school',
    response_deadline_at: null,
    result_content: '',
    review_approved_at: null,
    status: 'pending',
    support_count: 0,
    support_deadline_at: null,
    support_enabled: false,
    support_goal: null,
    support_met_at: null,
    title: 'Issue',
    ...overrides,
  };
}

function facilityFixture(overrides: Partial<FacilityRecord> = {}): FacilityRecord {
  return {
    affected_count: 1,
    author_uid: 'owner',
    canManageFacility: false,
    category_id: 'facility-a',
    closed_at: null,
    content: '',
    created_at: new Date('2026-01-01T00:00:00Z'),
    currentUserAffected: false,
    id: 'facility-1',
    isOwnFacility: false,
    location: 'Room 1',
    result_content: null,
    started_at: null,
    status: 'pending',
    title: 'Facility',
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function detailButtonLabels(wrapper: VueWrapper) {
  return wrapper.findAllComponents(DetailActionButton)
    .map((button) => String(button.props('label')));
}

describe('proposal detail permission actions', () => {
  beforeEach(() => setLocale('en'));

  it.each([
    {
      name: 'ordinary reader',
      canManage: false,
      isAdmin: false,
      status: 'pending' as const,
      deleteVisible: false,
      labels: [],
    },
    {
      name: 'proposal owner',
      canManage: true,
      isAdmin: false,
      status: 'pending' as const,
      deleteVisible: true,
      labels: [],
    },
    {
      name: 'category manager reviewing',
      canManage: true,
      isAdmin: true,
      status: 'under-review' as const,
      deleteVisible: true,
      labels: ['issue.review'],
    },
    {
      name: 'category manager processing',
      canManage: true,
      isAdmin: true,
      status: 'processing' as const,
      deleteVisible: true,
      labels: ['issue.changeStatusResult'],
    },
    {
      name: 'category manager on closed proposal',
      canManage: true,
      isAdmin: true,
      status: 'completed' as const,
      deleteVisible: true,
      labels: [],
    },
  ])('$name sees only the permitted controls', ({
    canManage,
    deleteVisible,
    isAdmin,
    labels,
    status,
  }) => {
    const wrapper = shallowMount(IssueDetailSupportFooter, {
      props: {
        canManage,
        currentUserSupported: false,
        isAdmin,
        issue: issueFixture({ canManageIssue: canManage, status }),
        operationTimeItems: [],
        statusLabel: status,
        supportClosed: false,
        supportCount: 0,
        supportProgressStyle: {},
        supportRemainingLabel: '',
      },
      global: {
        stubs: {
          DetailActionGroup: detailActionGroupStub,
        },
      },
    });

    expect(wrapper.getComponent(DetailActionGroup).props('showDelete')).toBe(deleteVisible);
    expect(detailButtonLabels(wrapper)).toEqual(labels);
  });

  it('forwards every visible manager, delete, and share action', async () => {
    const wrapper = shallowMount(IssueDetailSupportFooter, {
      props: {
        canManage: true,
        currentUserSupported: false,
        isAdmin: true,
        issue: issueFixture({ canManageIssue: true, status: 'under-review' }),
        operationTimeItems: [],
        statusLabel: 'Under review',
        supportClosed: false,
        supportCount: 0,
        supportProgressStyle: {},
        supportRemainingLabel: '',
      },
      global: {
        stubs: {
          DetailActionGroup: detailActionGroupStub,
        },
      },
    });
    const buttons = wrapper.findAllComponents(DetailActionButton);

    await buttons.find((button) => button.props('label') === 'issue.review')?.trigger('click');
    wrapper.getComponent(DetailActionGroup).vm.$emit('delete');
    wrapper.getComponent(DetailActionGroup).vm.$emit('share');

    expect(wrapper.emitted('moderate')).toHaveLength(1);
    expect(wrapper.emitted('edit-result')).toBeUndefined();
    expect(wrapper.emitted('delete')).toHaveLength(1);
    expect(wrapper.emitted('share')).toHaveLength(1);
  });
});

describe('facility detail permission actions', () => {
  beforeEach(() => setLocale('en'));

  it.each([
    {
      name: 'ordinary reader on active report',
      facility: facilityFixture(),
      closed: false,
      deleteVisible: false,
      affectedDisabled: false,
      statusVisible: false,
    },
    {
      name: 'owner on pending report',
      facility: facilityFixture({ isOwnFacility: true, currentUserAffected: true }),
      closed: false,
      deleteVisible: true,
      affectedDisabled: true,
      statusVisible: false,
    },
    {
      name: 'owner after processing starts',
      facility: facilityFixture({ isOwnFacility: true, status: 'processing' }),
      closed: false,
      deleteVisible: false,
      affectedDisabled: true,
      statusVisible: false,
    },
    {
      name: 'category manager on active report',
      facility: facilityFixture({ canManageFacility: true }),
      closed: false,
      deleteVisible: true,
      affectedDisabled: false,
      statusVisible: true,
    },
    {
      name: 'category manager on closed report',
      facility: facilityFixture({ canManageFacility: true, status: 'completed' }),
      closed: true,
      deleteVisible: true,
      affectedDisabled: true,
      statusVisible: false,
    },
  ])('$name sees only the permitted controls', ({
    affectedDisabled,
    closed,
    deleteVisible,
    facility,
    statusVisible,
  }) => {
    const wrapper = shallowMount(FacilityDetailActions, {
      props: {
        affecting: false,
        closed,
        facility,
        nextStatusActionLabel: 'facility.startProcessing',
        operationTimeItems: [],
      },
      global: {
        stubs: {
          DetailActionGroup: detailActionGroupStub,
        },
      },
    });
    const buttons = wrapper.findAllComponents(DetailActionButton);

    expect(wrapper.getComponent(DetailActionGroup).props('showDelete')).toBe(deleteVisible);
    expect(buttons[0]?.props('disabled')).toBe(affectedDisabled);
    expect(buttons.some((button) => button.props('label') === 'facility.startProcessing')).toBe(statusVisible);
  });

  it('forwards affected, status, delete, and share actions', async () => {
    const wrapper = shallowMount(FacilityDetailActions, {
      props: {
        affecting: false,
        closed: false,
        facility: facilityFixture({ canManageFacility: true }),
        nextStatusActionLabel: 'facility.startProcessing',
        operationTimeItems: [],
      },
      global: {
        stubs: {
          DetailActionGroup: detailActionGroupStub,
        },
      },
    });
    const buttons = wrapper.findAllComponents(DetailActionButton);

    await buttons[0]?.trigger('click');
    await buttons.find((button) => button.props('label') === 'facility.startProcessing')?.trigger('click');
    wrapper.getComponent(DetailActionGroup).vm.$emit('delete');
    wrapper.getComponent(DetailActionGroup).vm.$emit('share');

    expect(wrapper.emitted('toggleAffected')).toHaveLength(1);
    expect(wrapper.emitted('manageStatus')).toHaveLength(1);
    expect(wrapper.emitted('delete')).toHaveLength(1);
    expect(wrapper.emitted('share')).toHaveLength(1);
  });
});

describe('settings permission entry points', () => {
  beforeEach(() => {
    setLocale('en');
    categoryState.issuesEnabled = true;
  });

  const baseProps = {
    canManageCategories: false,
    canManageRoles: false,
    displayName: 'User',
    displayPhotoUrl: null,
    email: 'user@example.invalid',
    flat: true,
    isAdmin: false,
    personalNotificationOptions: [],
    personalPreferences: {
      announcementComment: true,
      facilityCreated: true,
      issueComment: true,
      issueCreated: true,
      issueStatus: true,
      supportGoal: true,
    },
    pushActionLabel: 'Enable',
    pushEnabled: false,
    pushError: '',
    pushLoading: false,
    pushStatusDescription: 'Disabled',
    uid: 'user-1',
  };

  it.each([
    {
      name: 'ordinary user',
      props: {},
      visible: ['My proposals', 'Restart app'],
      hidden: ['Statistics', 'System settings'],
    },
    {
      name: 'dashboard viewer',
      props: { isAdmin: true },
      visible: ['My proposals', 'Statistics', 'Restart app'],
      hidden: ['System settings'],
    },
    {
      name: 'role manager',
      props: { canManageRoles: true },
      visible: ['My proposals', 'System settings', 'Restart app'],
      hidden: ['Statistics'],
    },
    {
      name: 'category manager',
      props: { canManageCategories: true },
      visible: ['My proposals', 'System settings', 'Restart app'],
      hidden: ['Statistics'],
    },
  ])('$name sees the expected protected destinations', ({ hidden, props, visible }) => {
    const wrapper = shallowMount(SettingsPanelContent, {
      props: { ...baseProps, ...props },
      global: {
        stubs: {
          LabeledListSection: passthroughStub,
          SurfacePanel: passthroughStub,
        },
      },
    });
    const labels = wrapper.findAllComponents(IconListRow).map((row) => row.props('label'));

    for (const label of visible) expect(labels).toContain(label);
    for (const label of hidden) expect(labels).not.toContain(label);
  });

  it('hides My proposals when proposals are disabled and forwards destination actions', async () => {
    categoryState.issuesEnabled = false;
    const wrapper = shallowMount(SettingsPanelContent, {
      props: { ...baseProps, canManageCategories: true, isAdmin: true },
      global: {
        stubs: {
          LabeledListSection: passthroughStub,
          SurfacePanel: passthroughStub,
        },
      },
    });
    const rows = wrapper.findAllComponents(IconListRow);
    const labels = rows.map((row) => row.props('label'));

    expect(labels).not.toContain('My proposals');
    await rows.find((row) => row.props('label') === 'Statistics')?.trigger('click');
    await rows.find((row) => row.props('label') === 'System settings')?.trigger('click');
    await rows.find((row) => row.props('label') === 'Restart app')?.trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(2);
    expect(wrapper.emitted('restartApp')).toHaveLength(1);
  });
});
