import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import '@fontsource-variable/noto-sans-tc';
import './style.css';
import { initializeAppUpdate } from './composables/useAppUpdate';
import { initializeSession } from './composables/useSession';
import { initializeAppResume } from './composables/useAppResume';
import { tryRedirectToExternalBrowser } from './lib/in-app-browser';
import { initializeI18n } from './i18n';
import { preventDoubleTapZoom } from './lib/touch-zoom';
import { initializePressFeedback } from './lib/press-feedback';

async function bootstrap() {
  if (typeof window !== 'undefined') {
    if (tryRedirectToExternalBrowser(navigator.userAgent)) {
      return;
    }
  }

  initializeAppResume();
  preventDoubleTapZoom();
  initializePressFeedback();
  initializeI18n();
  void initializeAppUpdate();
  initializeSession();
  if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
    const { signInForE2e } = await import('./testing/e2e-auth');
    window.__NOVAE_E2E__ = { signIn: signInForE2e };
  }

  createApp(App).use(router).mount('#app');
}

void bootstrap();

