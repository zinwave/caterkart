import { Logger } from '@nestjs/common';

/**
 * Boot-time configuration check.
 *
 * The failure this prevents is the expensive one: a process that starts
 * happily, serves traffic, and only reveals at checkout — to a real customer,
 * holding a real cart — that RAZORPAY_WEBHOOK_SECRET was never set and the
 * payment will never settle. Every secret the app cannot function without is
 * asserted here, before the first request.
 *
 * Production is strict (throw). Development warns instead, because running the
 * Celebrations half without Twilio or Razorpay configured is a legitimate and
 * common local setup.
 */

interface Requirement {
  key: string;
  why: string;
  /** Values that are present but are obviously the placeholder from .env.example. */
  rejects?: string[];
  validate?: (value: string) => string | null;
}

const REQUIRED: Requirement[] = [
  {
    key: 'WEB_ORIGIN',
    why: 'the CORS allowlist and every OAuth redirect resolve against it',
    validate: (v) =>
      /^https:\/\//.test(v) ? null : 'must be an https:// origin in production',
  },
  {
    key: 'DATABASE_URL',
    why: 'Celebrations, accounts and Swiggy grants are stored in Postgres',
  },
  {
    key: 'TOKEN_ENC_KEY',
    why: 'Swiggy access tokens are encrypted at rest with it',
    rejects: ['00000000000000000000000000000000000000000000000000000000000000aa'],
    validate: (v) =>
      /^[0-9a-fA-F]{64}$/.test(v) ? null : 'must be 64 hex chars (openssl rand -hex 32)',
  },
  {
    key: 'APP_JWT_SECRET',
    why: 'it signs the session cookie — a known value means forgeable sessions',
    rejects: ['change-me-in-production', 'dev-secret'],
    validate: (v) => (v.length >= 32 ? null : 'must be at least 32 chars (openssl rand -hex 32)'),
  },
  {
    key: 'JWT_SECRET',
    why: 'it signs CaterBox staff and customer tokens',
    validate: (v) => (v.length >= 32 ? null : 'must be at least 32 chars (openssl rand -hex 32)'),
  },
  { key: 'MONGO_URI', why: 'CaterBox orders, combos and inventory live in MongoDB' },
  { key: 'RAZORPAY_KEY_ID', why: 'CaterBox checkout cannot collect payment without it' },
  { key: 'RAZORPAY_KEY_SECRET', why: 'CaterBox checkout cannot collect payment without it' },
  {
    key: 'RAZORPAY_WEBHOOK_SECRET',
    why: 'without it every payment webhook is rejected and no order ever settles',
  },
  { key: 'TWILLIO_ACCOUNT_SID', why: 'OTP sign-in sends SMS through Twilio' },
  { key: 'TWILLIO_AUTH_TOKEN', why: 'OTP sign-in sends SMS through Twilio' },
  { key: 'TWILLIO_SERVICES_ID', why: 'OTP sign-in uses a Twilio Verify service' },
];

export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const logger = new Logger('Config');
  const isProd = env.NODE_ENV === 'production';
  const problems: string[] = [];

  for (const req of REQUIRED) {
    const value = env[req.key]?.trim();
    if (!value) {
      problems.push(`${req.key} is not set — ${req.why}.`);
      continue;
    }
    if (req.rejects?.includes(value)) {
      problems.push(`${req.key} still holds the .env.example placeholder — ${req.why}.`);
      continue;
    }
    // Format rules are a production concern; locally http:// origins and short
    // secrets are the normal case.
    const failure = isProd ? req.validate?.(value) : null;
    if (failure) problems.push(`${req.key} ${failure}.`);
  }

  if (env.ENABLE_QUEUES === 'true' && !env.REDIS_URL?.trim()) {
    problems.push('ENABLE_QUEUES=true but REDIS_URL is not set — scheduled placements need Redis.');
  }

  if (!problems.length) return;

  if (isProd) {
    // Refuse to serve. A half-configured production process fails later, in
    // front of a customer, instead of here in front of a deploy log.
    throw new Error(
      `Refusing to start — ${problems.length} configuration problem(s):\n  - ${problems.join('\n  - ')}`,
    );
  }
  logger.warn(
    `${problems.length} configuration value(s) missing; the features that need them will not work:\n  - ${problems.join('\n  - ')}`,
  );
}
