import { defineConfig, loadEnv, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

function versionFilePlugin(version: string): Plugin {
  const source = JSON.stringify({ version });

  return {
    name: 'app-version-file',
    configureServer(server) {
      server.middlewares.use('/version.json', (_request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(source);
      });
    },
    generateBundle() {
      this.emitFile({
        fileName: 'version.json',
        source,
        type: 'asset',
      });
    },
  };
}

const APP_NAME = 'Novae';

function urlOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function htmlEnvPlugin(
  appVersion: string,
  env: Record<string, string>,
): Plugin {
  const apiOrigin = urlOrigin(env.VITE_API_BASE_URL ?? '');
  const localEnvironment = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::|$)/u.test(apiOrigin);
  const authEmulatorOrigin = urlOrigin(
    env.VITE_FIREBASE_AUTH_EMULATOR_URL
      || process.env.VITE_FIREBASE_AUTH_EMULATOR_URL
      || (localEnvironment ? 'http://127.0.0.1:9099' : '')
      || '',
  );
  const supabaseOrigin = urlOrigin(env.VITE_SUPABASE_URL ?? '');
  const supabaseRealtimeOrigin = supabaseOrigin.replace(/^http/u, 'ws');
  const connectSources = [
    "'self'",
    apiOrigin,
    authEmulatorOrigin,
    supabaseOrigin,
    supabaseRealtimeOrigin,
    'https://*.googleapis.com',
    'https://apis.google.com',
    'https://accounts.google.com',
    'https://www.google.com',
  ].filter(Boolean).join(' ');
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: ${apiOrigin} https://*.googleusercontent.com`.trim(),
    `connect-src ${connectSources}`,
    `frame-src ${[
      authEmulatorOrigin,
      'https://accounts.google.com',
      'https://www.google.com/recaptcha/',
      'https://recaptcha.google.com/recaptcha/',
    ].filter(Boolean).join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return {
    name: 'app-html-env',
    transformIndexHtml(html) {
      return html
        .replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`)
        .replaceAll('%APP_NAME%', APP_NAME)
        .replaceAll('%APP_VERSION%', appVersion);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appVersion = env.VITE_APP_VERSION
    || process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.GITHUB_SHA
    || process.env.npm_package_version
    || 'development';

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [
      htmlEnvPlugin(appVersion, env),
      versionFilePlugin(appVersion),
      vue(),
      tailwindcss(),
      VitePWA({
        filename: 'sw.ts',
        injectRegister: false,
        registerType: 'autoUpdate',
        srcDir: 'src',
        strategies: 'injectManifest',
        manifest: {
          name: APP_NAME,
          short_name: APP_NAME,
        description: 'Novae',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          display_override: ['standalone'],
          orientation: 'any',
          background_color: '#f7f7f3',
          theme_color: '#f7f7f3',
          icons: [
            {
              src: `pwa-64x64.png?v=${appVersion}`,
              sizes: '64x64',
              type: 'image/png',
            },
            {
              src: `pwa-192x192.png?v=${appVersion}`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: `pwa-512x512.png?v=${appVersion}`,
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: `maskable-icon-512x512.png?v=${appVersion}`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        injectManifest: {
          globIgnores: [
            'assets/firebase-app-check-*.js',
            'assets/firebase-messaging-*.js',
          ],
          globPatterns: [
            'index.html',
            'manifest.webmanifest',
            'assets/**/*.{js,css,wasm}',
            '*.{png,ico}',
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          chunkFileNames(chunkInfo) {
            if (chunkInfo.moduleIds.some((id) => id.includes('node_modules/@firebase/messaging/') || id.includes('node_modules/firebase/messaging/'))) {
              return 'assets/firebase-messaging-[hash].js';
            }
            if (chunkInfo.moduleIds.some((id) => id.includes('node_modules/@firebase/app-check/') || id.includes('node_modules/firebase/app-check/'))) {
              return 'assets/firebase-app-check-[hash].js';
            }
            return 'assets/[name]-[hash].js';
          },
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('node_modules/@firebase/messaging/') || id.includes('node_modules/firebase/messaging/')) {
                return;
              }
              if (id.includes('node_modules/@firebase/app-check/') || id.includes('node_modules/firebase/app-check/')) {
                return;
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
