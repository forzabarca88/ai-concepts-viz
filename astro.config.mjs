import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  // GitHub Pages deploys under /ai-concepts-viz subdirectory
  // Set GITHUB_PAGES=1 env var during CI/deployment to enable the base path
  base: process.env.GITHUB_PAGES ? '/ai-concepts-viz' : '',
  vite: {
    plugins: [tailwindcss()],
  },
});
