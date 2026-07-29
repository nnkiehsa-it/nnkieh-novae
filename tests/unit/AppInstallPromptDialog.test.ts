import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import AppInstallPromptDialog from '@/components/AppInstallPromptDialog.vue';
import { setLocale } from '@/i18n';

const passthrough = { template: '<div><slot /></div>' };

describe('AppInstallPromptDialog', () => {
  beforeEach(() => setLocale('en'));

  it('renders a translated in-app browser badge exactly once', () => {
    const wrapper = mount(AppInstallPromptDialog, {
      props: {
        browserName: 'LINE',
        canInstallNatively: false,
        installing: false,
        iosBrowserGuide: null,
        mode: 'in-app-browser',
        open: true,
        reason: 'default',
      },
      global: {
        stubs: {
          ConfirmDialog: true,
          DialogActionRow: passthrough,
          DialogShell: passthrough,
          IconTile: passthrough,
        },
      },
    });

    expect(wrapper.text()).toContain('LINE built-in browser');
    expect(wrapper.text()).not.toContain('app.install.');
  });
});
