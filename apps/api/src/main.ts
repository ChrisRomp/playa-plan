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

  // Configure how many proxy hops to trust for `req.ip`, helmet's
  // secure-context detection, and other X-Forwarded-* heuristics.
  // SECURITY: trusting forwarded headers when the API is reachable
  // without a trusted reverse proxy lets clients spoof their source IP
  // and bypass IP-based throttling. Set TRUST_PROXY explicitly per
  // deployment: a positive integer (number of trusted hops, e.g. `1`
  // when behind a single reverse proxy), `true` to trust all, or
  // `false`/`0` to trust none. Defaults to `false` so direct exposure
  // is safe by default; production deployments behind a proxy should
  // set `TRUST_PROXY=1` (or higher).
  const trustProxySetting = parseTrustProxy(process.env.TRUST_PROXY);
  app.set('trust proxy', trustProxySetting);

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

if (require.main === module) {
  bootstrap();
}

/**
 * Parse the TRUST_PROXY env var into the value expected by Express's
 * `trust proxy` setting. Accepts:
 *   - unset / empty → false (do not trust forwarded headers)
 *   - `false` / `0` → false
 *   - `true` → true (trust all)
 *   - positive integer → number of trusted proxy hops
 * Anything else falls back to false rather than silently trusting.
 */
export function parseTrustProxy(raw: string | undefined): boolean | number {
  if (raw === undefined || raw === '') return false;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0') return false;
  if (normalized === 'true') return true;
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return false;
}