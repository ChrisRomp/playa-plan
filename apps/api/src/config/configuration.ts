/**
 * Configuration factory for application settings
 * Loads and processes environment variables for various parts of the application
 */
export default () => ({
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Application general settings
  app: {
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
    name: process.env.APP_NAME || 'PlayaPlan',
  },

  // Database configuration 
  database: {
    url: process.env.DATABASE_URL,
    connectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10', 10) || 10,
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10) || 2,
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10) || 10,
    idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10) || 30000,
  },

  // Frontend configuration for CORS
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
  },

  // CORS configuration based on environment
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origins: process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',') 
      : [process.env.FRONTEND_URL || 'http://localhost:5173'],
    methods: process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Accept,Authorization',
    exposedHeaders: process.env.CORS_EXPOSED_HEADERS || '',
    credentials: process.env.CORS_CREDENTIALS === undefined ? true : process.env.CORS_CREDENTIALS !== 'false',
    maxAge: parseInt(process.env.CORS_MAX_AGE || '3600', 10) || 3600,
  },

  // JWT authentication
  jwt: {
    secret: process.env.JWT_SECRET,
    expirationTime: process.env.JWT_EXPIRATION_TIME || '24h',
  },

  // Payment providers are configured in the CoreConfig database table
  // and managed through the admin interface, not through environment variables

  // No default admin settings needed - admin users are created through
  // registration process or seeded in the database
});
