import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './style.css';
import { initializeAppUpdate } from './composables/useAppUpdate';
import { initializeSession } from './composables/useSession';
import { initializeAppResume } from './composables/useAppResume';

async function bootstrap() {
  initializeAppResume();
  void initializeAppUpdate();
  initializeSession();

  createApp(App).use(router).mount('#app');
}

void bootstrap();
