import { defineConfig, loadEnv, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
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

function htmlEnvPlugin(appTitle: string, appShortName: string, appVersion: string): Plugin {
  return {
    name: 'app-html-env',
    transformIndexHtml(html) {
      return html
        .replaceAll('%APP_TITLE%', appTitle)
        .replaceAll('%APP_SHORT_NAME%', appShortName)
        .replaceAll('%APP_VERSION%', appVersion);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appTitle = env.VITE_APP_TITLE || '學生權益提案平台';
  const appShortName = env.VITE_APP_SHORT_NAME || 'SRP';
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
      htmlEnvPlugin(appTitle, appShortName, appVersion),
      versionFilePlugin(appVersion),
      vue(),
      VitePWA({
        filename: 'sw.ts',
        injectRegister: false,
        registerType: 'autoUpdate',
        srcDir: 'src',
        strategies: 'injectManifest',
        manifest: {
          name: appTitle,
          short_name: appShortName,
          description: '校內學生公共議題、設備需求與學生權益維護提案平台',
          lang: 'zh-Hant',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          display_override: ['standalone'],
          orientation: 'portrait-primary',
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
          manualChunks(id) {
            if (id.includes('node_modules')) {
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
