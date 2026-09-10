import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api', { exclude: ['auth/swiggy/callback'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  // Reflect the configured web origin, plus any localhost/127.0.0.1 port (Vite
  // often falls back from 5173 → 5174…), and allow non-browser callers (no
  // Origin header). Reflecting the exact origin is required for credentialed
  // requests — a wildcard '*' is rejected by the browser when credentials:'include'.
  const webOrigin = config.get<string>('WEB_ORIGIN', 'http://localhost:5173');
  const isProd = config.get<string>('nodeEnv') === 'production';
  app.enableCors({
    origin: (origin, cb) => {
      // In production the allowlist is exactly the configured web origin.
      // Reflecting any localhost port is a development convenience (Vite falls
      // back 5173 → 5174…), and with `credentials: true` it would otherwise let
      // a page served from the user's own machine make authenticated calls.
      const ok =
        !origin ||
        origin === webOrigin ||
        (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
      cb(null, ok);
    },
    credentials: true,
  });

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`CaterKart API on :${port} — live Swiggy MCP`);
}
bootstrap();
