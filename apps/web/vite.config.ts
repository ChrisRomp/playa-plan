import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Removed proxy configuration to match production behavior
  // API calls will go directly to backend, allowing CORS issues to surface
});
