import { defineConfig } from 'vitest/config';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // This root-level config delegates to the web app
  root: path.resolve(__dirname, 'apps/web'),
}); 