# API Dockerfile for local development
# Pin to specific patch version for better reproducibility
FROM node:22.12.0-alpine3.20

# Add build arguments for dynamic versioning
ARG IMAGE_VERSION=dev
ARG BUILD_DATE
ARG GIT_COMMIT

# Add OCI labels with dynamic values
LABEL org.opencontainers.image.title="PlayaPlan API"
LABEL org.opencontainers.image.description="NestJS backend API for PlayaPlan camp registration system"
LABEL org.opencontainers.image.source="https://github.com/ChrisRomp/playa-plan"
LABEL org.opencontainers.image.authors="Chris Romp"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.version="${IMAGE_VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY libs/ ./libs/
COPY tsconfig*.json ./

# Install dependencies
RUN npm install

# Copy API source code
COPY apps/api/ ./apps/api/

# Copy shared libs if needed
COPY libs/ ./libs/

# Set working directory to API
WORKDIR /app/apps/api

# Generate Prisma client
RUN npx prisma generate

# Create entrypoint script
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Add health check using the new /health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use entrypoint script to handle database initialization
ENTRYPOINT ["./docker-entrypoint.sh"]

# Default command is environment-aware
CMD [ "sh", "-c", \
      "if [ \"$NODE_ENV\" = \"production\" ]; then \
         echo \"Starting in PRODUCTION mode\"; \
         npm run start:prod; \
       else \
         echo \"Starting in DEVELOPMENT mode\"; \
         npm run dev; \
       fi" \
    ]
