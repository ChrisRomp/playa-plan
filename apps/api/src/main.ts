import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { createMetricsServer } from './metrics-server';
import { validateWebAuthnConfig, WebAuthnConfig } from './config/webauthn-config.validator';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Trust the first reverse proxy in front of the API so that `req.ip` and
  // helmet's secure-context detection use the X-Forwarded-* values rather
  // than the proxy's loopback address. Without this, throttling buckets all
  // real clients behind a single proxy IP and CSP / cookie security
  // heuristics may misbehave under HTTPS termination at the proxy.
  app.set('trust proxy', 1);

  // Validate WebAuthn (passkey) config early so misconfigured RP ID / origin
  // pairs fail boot with a clear error rather than producing silent browser
  // rejections at registration/authentication time.
  validateWebAuthnConfig(configService.get<WebAuthnConfig>('webauthn')!);

  // Start the internal metrics server (port 9464)
  await createMetricsServer();
  
  // Apply helmet middleware for security headers
  app.use(helmet());
  
  // Global validation and sanitization pipe
  app.useGlobalPipes(new GlobalValidationPipe());

  // CORS configuration using settings from config service
  const corsConfig = configService.get('cors');
  app.enableCors({
    origin: corsConfig.origins,
    methods: corsConfig.methods,
    credentials: corsConfig.credentials,
    allowedHeaders: corsConfig.allowedHeaders,
    exposedHeaders: corsConfig.exposedHeaders,
    maxAge: corsConfig.maxAge,
  });
  
  console.log(`CORS configured with origins: ${corsConfig.origins}`);
  
  // Swagger documentation setup
  const config = new DocumentBuilder()
    .setTitle('PlayaPlan API')
    .setDescription('API for managing camp registrations and shifts')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start main API server
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 API server running on: http://localhost:${port}`);
  console.log(`📊 Metrics available internally at: http://localhost:9464/metrics`);
}

bootstrap();