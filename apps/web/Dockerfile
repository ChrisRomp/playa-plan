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

# Development stage - for development mode
FROM base AS development
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Production stage - serves built files
FROM node:22.12.0-alpine3.20 AS production

WORKDIR /app/apps/web

# Copy package.json for preview server
COPY apps/web/package*.json ./

# Install only production dependencies + vite for preview server
RUN npm install --production && npm install vite

# Copy built application from build stage
COPY --from=build /app/apps/web/dist ./dist

EXPOSE 5173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "5173"]

# Default stage - runtime decision between dev and prod
FROM base AS runtime

# Create entrypoint script to handle dev/prod modes
RUN echo '#!/bin/sh\n\
if [ "$NODE_ENV" = "production" ]; then\n\
  echo "Building for production..."\n\
  npm run build\n\
  echo "Starting production server..."\n\
  npm run preview -- --host 0.0.0.0 --port 5173\n\
else\n\
  echo "Starting development server..."\n\
  npm run dev -- --host 0.0.0.0\n\
fi' > /app/apps/web/entrypoint.sh && chmod +x /app/apps/web/entrypoint.sh

EXPOSE 5173
ENTRYPOINT ["./entrypoint.sh"]
