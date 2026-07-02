import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    assetName(type, size) {
      if (type === 'transparent') {
        return `pwa-${size.width}x${size.height}.png`;
      }
      if (type === 'maskable') {
        return `maskable-icon-${size.width}x${size.height}.png`;
      }
      if (type === 'apple') {
        return `apple-touch-icon-${size.width}x${size.height}.png`;
      }
      return 'favicon';
    },
  },
  images: ['public/logo.svg'],
});
