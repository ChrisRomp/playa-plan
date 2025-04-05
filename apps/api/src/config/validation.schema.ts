import * as Joi from 'joi';

/**
 * Validation schema for environment variables
 * Ensures that required environment variables are present and have correct format
 */
const validationSchema = Joi.object({
  // Required variables
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  
  // Optional variables with defaults
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  
  // Database connection pool config
  DATABASE_CONNECTION_LIMIT: Joi.number().default(10),
  DATABASE_POOL_MIN: Joi.number().default(2),
  DATABASE_POOL_MAX: Joi.number().default(10),
  DATABASE_IDLE_TIMEOUT: Joi.number().default(30000),
  
  // Frontend URL
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
  
  // CORS configuration
  CORS_ENABLED: Joi.boolean().default(true),
  CORS_ORIGINS: Joi.string(),
  CORS_METHODS: Joi.string(),
  CORS_ALLOWED_HEADERS: Joi.string(),
  CORS_EXPOSED_HEADERS: Joi.string(),
  CORS_CREDENTIALS: Joi.boolean().default(false),
  CORS_MAX_AGE: Joi.number(),
  
  // JWT configuration
  JWT_EXPIRATION_TIME: Joi.string().default('24h'),
  
  // Email configuration
  MAIL_HOST: Joi.string(),
  MAIL_PORT: Joi.number().default(587),
  MAIL_USER: Joi.string(),
  MAIL_PASSWORD: Joi.string(),
  MAIL_FROM: Joi.string().email(),
  MAIL_SECURE: Joi.boolean().default(false),
  MAIL_IGNORE_TLS: Joi.boolean().default(false),
  MAIL_REQUIRE_TLS: Joi.boolean().default(false),
  MAIL_DEBUG: Joi.boolean().default(false),
  
  // Stripe configuration
  STRIPE_SECRET_KEY: Joi.string(),
  STRIPE_PUBLIC_KEY: Joi.string(),
  STRIPE_WEBHOOK_SECRET: Joi.string(),
  
  // PayPal configuration
  PAYPAL_CLIENT_ID: Joi.string(),
  PAYPAL_CLIENT_SECRET: Joi.string(),
  PAYPAL_MODE: Joi.string().valid('sandbox', 'live').default('sandbox'),
  
  // Admin defaults
  DEFAULT_ADMIN_EMAIL: Joi.string().email().default('webadmin@example.com'),
  DEFAULT_ADMIN_PASSWORD: Joi.string(),
});

export default validationSchema;
