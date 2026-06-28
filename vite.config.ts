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
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/main.ts',           // app entry — wired at runtime
        'src/App.ts',            // app composition — wired at runtime
        'src/types/**',          // pure type files
        // Pure canvas drawing routines — testing ctx.arc() is theatre
        'src/render/sprites/**',
        'src/render/renderer.ts',  // tightly coupled to canvas — integration test only
        'src/render/canvas.ts',   // DOM canvas wrapper — integration test only
        // DOM-heavy pages — require full DOM environment, integration test only
        'src/pages/**',
        'src/ui/components/modal.ts',
        'src/ui/hud.ts'
      ]
    }
  }
});