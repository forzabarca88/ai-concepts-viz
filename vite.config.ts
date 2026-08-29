import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages deploys to https://forzabarca88.github.io/ai-concepts-viz/
  base: '/ai-concepts-viz/',
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
