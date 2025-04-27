# PlayaPlan

PlayaPlan is a full-stack web application for managing annual camp registrations. It enables user registration, profile management, and authentication using JWT and Passport.js. Users can sign up for camp job shifts scheduled within admin-defined camp sessions.

## Tech Stack

- **Frontend:** React with TypeScript and Tailwind CSS
- **Backend API:** NestJS with TypeScript
- **Database:** PostgreSQL managed via Prisma ORM
- **Authentication:** Passport.js with JWT
- **Payments:** Stripe and PayPal integrations (upcoming)
- **Notifications:** Transactional emails via SendGrid

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Docker and Docker Compose

### Project Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd playa-plan
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.sample .env
   ```
   Edit the `.env` file and update the necessary configurations.

### Starting the Application

#### Method 1: Using the Startup Script (Recommended)

We provide a convenient startup script that handles environment variables, database setup, and starting both the frontend and backend:

```bash
chmod +x start.sh  # Make the script executable (first time only)
./start.sh
```

The script will:
- Load environment variables from `.env`
- Start PostgreSQL using Docker Compose
- Run database migrations and generate Prisma client
- Build and start the NestJS API
- Start the React frontend development server

#### Method 2: Manual Startup

If you prefer to start components individually:

1. Start the PostgreSQL database:
   ```bash
   docker-compose up -d
   ```

2. Setup the database and start the API:
   ```bash
   cd apps/api
   npx prisma migrate dev
   npm run build
   npm run start
   ```

3. Start the frontend in a separate terminal:
   ```bash
   cd apps/web
   npm run dev
   ```

### Accessing the Application

- Frontend: http://localhost:5173
- API: http://localhost:3000
- API Documentation: http://localhost:3000/api

## Development Workflow

- Frontend tasks are tracked in [Web-tasks.md](Web-tasks.md)
- Backend/API tasks are tracked in [API-tasks.md](API-tasks.md)

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL container is running: `docker ps`
- Check if the database credentials in `.env` match the ones in `docker-compose.yml`
- Verify that the database port (5432) is not already in use

### Frontend Styling Issues
- If you encounter Tailwind CSS errors, reinstall the PostCSS plugin:
  ```bash
  cd apps/web
  npm install -D @tailwindcss/postcss autoprefixer postcss
  ```

### API Startup Issues
- Check error logs in the console
- Verify that all required environment variables are set
- Ensure the API is properly built: `cd apps/api && npm run build`

## License

[MIT License](LICENSE.md) 