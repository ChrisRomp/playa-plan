/**
 * Configuration factory for application settings
 * Loads and processes environment variables for various parts of the application
 */
export default () => ({
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

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
    credentials: process.env.CORS_CREDENTIALS === 'true',
    maxAge: parseInt(process.env.CORS_MAX_AGE || '3600', 10) || 3600,
  },

  // JWT authentication
  jwt: {
    secret: process.env.JWT_SECRET,
    expirationTime: process.env.JWT_EXPIRATION_TIME || '24h',
  },

  // Email service configuration
  email: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT || '587', 10) || 587,
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM || 'noreply@example.com',
    secure: process.env.MAIL_SECURE === 'true',
    ignoreTLS: process.env.MAIL_IGNORE_TLS === 'true',
    requireTLS: process.env.MAIL_REQUIRE_TLS === 'true',
    debug: process.env.MAIL_DEBUG === 'true',
  },

  // Payment providers
  payment: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publicKey: process.env.STRIPE_PUBLIC_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      mode: process.env.PAYPAL_MODE || 'sandbox',
    },
  },

  // Default admin settings
  defaults: {
    adminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'webadmin@example.com',
    adminPassword: process.env.DEFAULT_ADMIN_PASSWORD,
  },
});
