import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const profile = mode === 'desktop' ? 'desktop' : 'web';
  return {
    base: './',
    define: {
      __MS_PROFILE__: JSON.stringify(profile)
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          preview: resolve(__dirname, 'preview.html')
        }
      },
      outDir: 'dist'
    },
    server: {
      port: 3000
    }
  };
});
