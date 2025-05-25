# GitHub Copilot Development Environment Setup

This document describes how to set up the GitHub Copilot development environment for the PlayaPlan project.

## Node.js Version

The project uses Node.js version 22. An `.nvmrc` file is included in the repository for Node Version Manager support.

```bash
# If you use nvm, you can easily switch to the correct Node version with:
nvm use
```

## Dependencies

The project has dependencies at both the root level and the application level (web and API).

### Installing Dependencies

```bash
# Install all dependencies (root, api, web)
npm install

# Install only API dependencies
npm install --workspace=api

# Install only web dependencies
npm install --workspace=web
```

## Development Environment

The project has two applications:
- API service (NestJS) in `apps/api`
- Web frontend (React) in `apps/web`

### Starting the Development Environment

```bash
# Start both API and web app
npm run dev

# Start only API
npm run dev:api

# Start only web app
npm run dev:web
```

### Ports

- API service runs on port 3000
- Web application runs on port 5173

## Environment Configuration

Copy the `.env.sample` file to create a `.env` file in the repository root:

```bash
cp .env.sample .env
```

Make sure to update any configuration values as needed for your local development environment.

## Testing

```bash
# Run all tests
npm run test

# Run only API tests
npm run test:api

# Run only web tests
npm run test:web

# Run tests in watch mode
npm run test:watch
```

## GitHub Copilot Configuration

The repository includes a `.github/copilot-config.json` file that configures GitHub Copilot to understand the development environment, including:

- Install command
- Development command and ports
- Test command

## Database Setup

For API development, you need to set up a PostgreSQL database:

1. Create a PostgreSQL database named `playaplan`
2. Update the `DATABASE_URL` in your `.env` file
3. Initialize the database schema:

```bash
cd apps/api
npm run db:setup
```