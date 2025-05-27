# Multi-stage Dockerfile for web application
FROM node:22.12.0-alpine3.20 AS base

# Add build arguments for dynamic versioning
ARG IMAGE_VERSION=dev
ARG BUILD_DATE
ARG GIT_COMMIT

# Add OCI labels with dynamic values
LABEL org.opencontainers.image.title="PlayaPlan Web"
LABEL org.opencontainers.image.description="React frontend for PlayaPlan camp registration system"
LABEL org.opencontainers.image.source="https://github.com/ChrisRomp/playa-plan"
LABEL org.opencontainers.image.authors="Chris Romp"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.version="${IMAGE_VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY libs/ ./libs/
COPY tsconfig*.json ./

# Install all dependencies
RUN npm install

# Copy source code
COPY apps/web/ ./apps/web/
COPY libs/ ./libs/

WORKDIR /app/apps/web

# Build stage - creates production build
FROM base AS build
RUN npm run build

# Runtime stage - serves built files using nginx
FROM nginx:alpine AS runtime

# Create a separate nginx configuration file
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# Copy runtime config template
COPY --from=build /app/apps/web/public/runtime-config.js /usr/share/nginx/html/

# Create nginx configuration
RUN echo 'server { \
    listen 5173; \
    server_name localhost; \
    gzip on; \
    gzip_types text/css application/javascript application/json image/svg+xml; \
    gzip_comp_level 9; \
    \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Handle SPA routing - redirect all non-file requests to index.html \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Caching settings for static assets \
    location ~* \\.(css|js|jpg|jpeg|png|gif|ico|svg|woff2)$ { \
        expires 30d; \
        add_header Cache-Control "public, max-age=2592000"; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Create a custom entrypoint script with environment variable substitution
RUN echo '#!/bin/sh' > /usr/local/bin/entrypoint.sh && \
    echo 'API_URL=${API_URL:-http://localhost:3000}' >> /usr/local/bin/entrypoint.sh && \
    echo 'echo "Configuring web app with API_URL=$API_URL"' >> /usr/local/bin/entrypoint.sh && \
    echo 'envsubst < /usr/share/nginx/html/runtime-config.js > /usr/share/nginx/html/runtime-config.js.tmp' >> /usr/local/bin/entrypoint.sh && \
    echo 'mv /usr/share/nginx/html/runtime-config.js.tmp /usr/share/nginx/html/runtime-config.js' >> /usr/local/bin/entrypoint.sh && \
    echo 'echo "Starting nginx server..."' >> /usr/local/bin/entrypoint.sh && \
    echo 'nginx -g "daemon off;"' >> /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 5173
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
