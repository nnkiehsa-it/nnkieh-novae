import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import '../node_modules/harmonyos-sans-webfont-splitted/dist/HarmonyOS_Sans_TC/Regular.css';
import '../node_modules/harmonyos-sans-webfont-splitted/dist/HarmonyOS_Sans_TC/Medium.css';
import '../node_modules/harmonyos-sans-webfont-splitted/dist/HarmonyOS_Sans_TC/Semibold.css';
import '../node_modules/harmonyos-sans-webfont-splitted/dist/HarmonyOS_Sans_TC/Bold.css';
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

  createApp(App).use(router).mount('#app');
}

void bootstrap();

