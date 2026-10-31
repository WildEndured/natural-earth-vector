import { defineConfig } from 'vite';

// ⚠️ ЗАМЕНИ 'war-game' на имя твоего GitHub-репозитория
export default defineConfig({
  base: '/natural-earth-vector/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
