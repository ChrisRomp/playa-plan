import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { join } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Custom plugin to serve static health check at /health
    {
      name: 'health-endpoint',
      configureServer(server) {
        server.middlewares.use('/health', (req, res, next) => {
          if (req.method === 'GET') {
            try {
              res.setHeader('Content-Type', 'text/html');
              const healthHtml = readFileSync(
                join(process.cwd(), 'public/health.html'),
                'utf-8'
              );
              res.end(healthHtml);
            } catch {
              res.statusCode = 500;
              res.end('Health check unavailable');
            }
          } else {
            next();
          }
        });
      },
    },
  ],
  // Removed proxy configuration to match production behavior
  // API calls will go directly to backend, allowing CORS issues to surface
});
