import { defineConfig } from 'vite';
import { resolve } from 'path';
import { existsSync } from 'fs';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: existsSync('./src/audio/audioEngine.ts')
      ? {
          output: {
            manualChunks: {
              audio: ['./src/audio/audioEngine.ts']
            }
          }
        }
      : undefined
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts']
  }
});