import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import CategoryWizardDialog from '@/components/admin/CategoryWizardDialog.vue';
import { setLocale } from '@/i18n';

const passthrough = { template: '<div><slot /></div>' };

describe('CategoryWizardDialog', () => {
  beforeEach(() => setLocale('en'));

  it('keeps a new facility category as a draft until the final confirmation', async () => {
    const wrapper = mount(CategoryWizardDialog, {
      props: {
        kind: 'facility',
        open: true,
        sortOrder: 3,
      },
      global: {
        stubs: {
          DialogActionRow: passthrough,
          DialogHeading: true,
          DialogShell: passthrough,
          SurfacePanel: passthrough,
        },
      },
    });

    await wrapper.get('#wizard-label').setValue('Library Devices');
    expect((wrapper.get('#wizard-id').element as HTMLInputElement).value).toBe('library-devices');

    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('created')).toBeUndefined();

    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('created')).toEqual([[
      {
        id: 'library-devices',
        isDefault: false,
        label: 'Library Devices',
        sortOrder: 3,
      },
    ]]);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
