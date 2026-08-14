import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Base path for GitHub Pages project sites: https://<user>.github.io/Bekasda/
// Override with VITE_BASE_PATH=/ for a custom domain or user/organization site.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/Bekasda/',
  plugins: [react(), tailwindcss()],
});
