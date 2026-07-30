import { flushPromises, shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import CategoryManagementSection from '@/components/categories/CategoryManagementSection.vue';
import CategoryWorkflowPanel from '@/components/admin/CategoryWorkflowPanel.vue';
import MemberAccessPanel from '@/components/admin/MemberAccessPanel.vue';
import MemberAccessRow from '@/components/admin/MemberAccessRow.vue';
import PillSegmentedControl from '@/components/ui/molecules/PillSegmentedControl.vue';
import PlatformFeatureToggle from '@/components/categories/PlatformFeatureToggle.vue';
import { setLocale } from '@/i18n';

const issueCategory = {
  authorVisible: true,
  commentsEnabled: true,
  id: 'issue-a',
  isDefault: true,
  label: 'Issue A',
  readAccess: 'school' as const,
  responseDeadlineDays: null,
  sortOrder: 0,
  supportDeadlineDays: null,
  supportEnabled: false,
  supportGoal: null,
};
const facilityCategory = {
  id: 'facility-a',
  isDefault: true,
  label: 'Facility A',
  sortOrder: 0,
};
const accessCandidate = {
  displayName: 'Target User',
  email: 'target@example.invalid',
  managedFacilityCategoryIds: [],
  managedIssueCategoryIds: [],
  roles: [],
  uid: 'target-uid',
};

const categoryService = vi.hoisted(() => ({
  getCategoryManagement: vi.fn(),
  saveCategoryManagement: vi.fn(),
}));
const accessService = vi.hoisted(() => ({
  listScopeMembers: vi.fn(),
  lookupAccessMember: vi.fn(),
  setUserAccessScope: vi.fn(),
}));
const catalog = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock('@/services/categories', () => categoryService);
vi.mock('@/services/access', () => accessService);
vi.mock('@/composables/useCategories', async () => {
  const { ref } = await import('vue');
  return {
    useCategories: () => ({
      activeFacilityCategories: ref([{
        id: 'facility-a',
        isDefault: true,
        label: 'Facility A',
        sortOrder: 0,
      }]),
      activeIssueCategories: ref([{
        authorVisible: true,
        commentsEnabled: true,
        id: 'issue-a',
        isDefault: true,
        label: 'Issue A',
        readAccess: 'school',
        responseDeadlineDays: null,
        sortOrder: 0,
        supportDeadlineDays: null,
        supportEnabled: false,
        supportGoal: null,
      }]),
      refresh: catalog.refresh,
    }),
  };
});

const passthroughStub = {
  template: '<div><slot /></div>',
};
const categoryManagementStub = {
  name: 'CategoryManagementSection',
  props: {
    modelValue: {
      default: () => [],
      type: Array,
    },
    onDelete: {
      default: undefined,
      type: Function,
    },
  },
  emits: ['update:modelValue'],
  template: '<div><slot name="header-actions" /></div>',
};
const selectionOptionStub = {
  name: 'SelectionOptionButton',
  props: {
    label: {
      default: '',
      type: String,
    },
    selected: {
      default: false,
      type: Boolean,
    },
  },
  emits: ['select'],
  template: '<button type="button" @click="$emit(\'select\')">{{ label }}</button>',
};
const memberAccessRowStub = {
  name: 'MemberAccessRow',
  props: {
    actionLabel: {
      default: '',
      type: String,
    },
    member: {
      default: undefined,
      type: Object,
    },
  },
  emits: ['action'],
  template: '<button type="button" @click="$emit(\'action\')">{{ actionLabel }}</button>',
};

describe('category workflow controls', () => {
  beforeEach(() => {
    setLocale('en');
    vi.clearAllMocks();
    categoryService.getCategoryManagement.mockResolvedValue({
      features: { facilitiesEnabled: true, issuesEnabled: true },
      facilityCategories: [facilityCategory],
      issueCategories: [issueCategory],
    });
    categoryService.saveCategoryManagement.mockImplementation(async (draft) => ({
      features: {
        facilitiesEnabled: draft.facilitiesEnabled,
        issuesEnabled: draft.issuesEnabled,
      },
      facilityCategories: draft.facilityCategories,
      issueCategories: draft.issueCategories,
      success: true,
    }));
  });

  it('stages both feature switches and category create/edit/delete before one save', async () => {
    const wrapper = shallowMount(CategoryWorkflowPanel, {
      global: {
        stubs: {
          CategoryManagementSection: categoryManagementStub,
          SurfacePanel: passthroughStub,
        },
      },
    });
    await flushPromises();

    const issueSection = wrapper.getComponent(CategoryManagementSection);
    const newIssueCategory = {
      ...issueCategory,
      id: 'issue-new',
      isDefault: false,
      label: 'New issue category',
      sortOrder: 1,
    };
    issueSection.vm.$emit('update:modelValue', [
      { ...issueCategory, label: 'Renamed issue category' },
      newIssueCategory,
    ]);
    await wrapper.vm.$nextTick();
    await issueSection.props('onDelete')(0);
    wrapper.getComponent(PlatformFeatureToggle).vm.$emit('toggle');

    wrapper.getComponent(PillSegmentedControl).vm.$emit('update:modelValue', 'facility');
    await wrapper.vm.$nextTick();
    const facilitySection = wrapper.getComponent(CategoryManagementSection);
    facilitySection.vm.$emit('update:modelValue', [
      { ...facilityCategory, label: 'Renamed facility category' },
    ]);
    wrapper.getComponent(PlatformFeatureToggle).vm.$emit('toggle');
    await wrapper.getComponent(AppButton).trigger('click');
    await flushPromises();

    expect(categoryService.saveCategoryManagement).toHaveBeenCalledTimes(1);
    expect(categoryService.saveCategoryManagement).toHaveBeenCalledWith({
      deletedFacilityCategoryIds: [],
      deletedIssueCategoryIds: ['issue-a'],
      facilitiesEnabled: false,
      facilityCategories: [{ ...facilityCategory, label: 'Renamed facility category' }],
      issueCategories: [{ ...newIssueCategory, sortOrder: 0 }],
      issuesEnabled: false,
    });
    expect(catalog.refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the whole draft available for retry when the atomic save fails', async () => {
    categoryService.saveCategoryManagement.mockRejectedValueOnce(new Error('common.saveFailed'));
    const wrapper = shallowMount(CategoryWorkflowPanel, {
      global: {
        stubs: {
          CategoryManagementSection: categoryManagementStub,
          SurfacePanel: passthroughStub,
        },
      },
    });
    await flushPromises();

    wrapper.getComponent(PlatformFeatureToggle).vm.$emit('toggle');
    await wrapper.getComponent(AppButton).trigger('click');
    await flushPromises();
    await wrapper.getComponent(AppButton).trigger('click');
    await flushPromises();

    expect(categoryService.saveCategoryManagement).toHaveBeenCalledTimes(2);
    expect(categoryService.saveCategoryManagement.mock.calls[0]?.[0].issuesEnabled).toBe(false);
    expect(categoryService.saveCategoryManagement.mock.calls[1]?.[0].issuesEnabled).toBe(false);
    expect(catalog.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('member access controls', () => {
  beforeEach(() => {
    setLocale('en');
    vi.clearAllMocks();
    accessService.listScopeMembers.mockResolvedValue({ truncated: false, users: [] });
    accessService.lookupAccessMember.mockResolvedValue({ truncated: false, users: [accessCandidate] });
    accessService.setUserAccessScope.mockImplementation(async (_uid, scope, grant) => ({
      managedFacilityCategoryIds: grant && scope.kind === 'facility' ? [scope.categoryId] : [],
      managedIssueCategoryIds: grant && scope.kind === 'issue' ? [scope.categoryId] : [],
      roles: grant && scope.kind === 'announcement' ? ['announcement-manager'] : [],
      success: true,
    }));
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('selects each scope and sends exact grant and revoke actions from the visible member button', async () => {
    const wrapper = shallowMount(MemberAccessPanel, {
      global: {
        stubs: {
          MemberAccessRow: memberAccessRowStub,
          SelectionOptionButton: selectionOptionStub,
          SurfacePanel: passthroughStub,
        },
      },
    });
    await flushPromises();

    const lookup = wrapper.get('#access-member-lookup');
    await lookup.setValue('target@example.invalid');
    await wrapper.getComponent(AppButton).trigger('click');
    await flushPromises();
    wrapper.getComponent(MemberAccessRow).vm.$emit('action');
    await flushPromises();

    expect(accessService.setUserAccessScope).toHaveBeenLastCalledWith(
      'target-uid',
      { categoryId: 'issue-a', kind: 'issue' },
      true,
    );

    const issueOption = wrapper.findAllComponents(selectionOptionStub)
      .find((option) => option.props('label') === 'Facility-report responsibilities');
    await issueOption?.trigger('click');
    await flushPromises();
    const facilityCategoryOption = wrapper.findAllComponents(selectionOptionStub)
      .find((option) => option.props('label') === 'Facility A');
    await facilityCategoryOption?.trigger('click');
    await flushPromises();
    await lookup.setValue('target@example.invalid');
    await wrapper.getComponent(AppButton).trigger('click');
    await flushPromises();
    wrapper.getComponent(MemberAccessRow).vm.$emit('action');
    await flushPromises();

    expect(accessService.setUserAccessScope).toHaveBeenLastCalledWith(
      'target-uid',
      { categoryId: 'facility-a', kind: 'facility' },
      true,
    );

    const announcementOption = wrapper.findAllComponents(selectionOptionStub)
      .find((option) => option.props('label') === 'Announcement management');
    await announcementOption?.trigger('click');
    await flushPromises();
    await lookup.setValue('target@example.invalid');
    await wrapper.getComponent(AppButton).trigger('click');
    await flushPromises();
    wrapper.getComponent(MemberAccessRow).vm.$emit('action');
    await flushPromises();
    wrapper.getComponent(MemberAccessRow).vm.$emit('action');
    await flushPromises();

    expect(accessService.setUserAccessScope).toHaveBeenNthCalledWith(
      3,
      'target-uid',
      { kind: 'announcement' },
      true,
    );
    expect(accessService.setUserAccessScope).toHaveBeenNthCalledWith(
      4,
      'target-uid',
      { kind: 'announcement' },
      false,
    );
  });
});
