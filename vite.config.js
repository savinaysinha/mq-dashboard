import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from 'path';

export default defineConfig({
  plugins: [react()],
   root: 'frontend',          // ← tell Vite where your source root is
  build: {
    outDir: '../public',     // ← output still goes to project root /public
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000"
    }
  }
});
