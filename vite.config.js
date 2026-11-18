import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const profile = mode === 'desktop' ? 'desktop' : 'web';
  return {
    base: './',
    define: {
      __MS_PROFILE__: JSON.stringify(profile)
    },
    resolve: {
      alias: profile === 'web' ? {
        './desktop/index.js': resolve(__dirname, 'src/platform/web/stub.js')
      } : {}
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
