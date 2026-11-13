import { validateEnvironment } from './env.validation';

/**
 * Production must refuse to start on a configuration that would fail later, in
 * front of a customer. Development must not, or nobody can run half the app.
 */
describe('validateEnvironment', () => {
  const complete = {
    NODE_ENV: 'production',
    WEB_ORIGIN: 'https://caterkart.in',
    DATABASE_URL: 'postgresql://u:p@db:5432/caterkart',
    TOKEN_ENC_KEY: 'a'.repeat(64),
    APP_JWT_SECRET: 'b'.repeat(64),
    JWT_SECRET: 'c'.repeat(64),
    MONGO_URI: 'mongodb://mongo:27017',
    // Deliberately not a realistic `rzp_live_…` shape: a test fixture that
    // looks like a live key trips secret scanners in CI.
    RAZORPAY_KEY_ID: 'test-key-id',
    RAZORPAY_KEY_SECRET: 'secret',
    RAZORPAY_WEBHOOK_SECRET: 'whsec',
    TWILLIO_ACCOUNT_SID: 'AC1',
    TWILLIO_AUTH_TOKEN: 'tok',
    TWILLIO_SERVICES_ID: 'VA1',
  } as NodeJS.ProcessEnv;

  it('accepts a complete production configuration', () => {
    expect(() => validateEnvironment(complete)).not.toThrow();
  });

  it.each([
    ['APP_JWT_SECRET', 'change-me-in-production'],
    ['TOKEN_ENC_KEY', '00000000000000000000000000000000000000000000000000000000000000aa'],
  ])('rejects the .env.example placeholder for %s', (key, placeholder) => {
    expect(() => validateEnvironment({ ...complete, [key]: placeholder })).toThrow(/placeholder/);
  });

  it('rejects a token encryption key that is not 32 bytes of hex', () => {
    expect(() => validateEnvironment({ ...complete, TOKEN_ENC_KEY: 'tooshort' })).toThrow(
      /TOKEN_ENC_KEY/,
    );
  });

  it('rejects a plaintext production origin', () => {
    expect(() => validateEnvironment({ ...complete, WEB_ORIGIN: 'http://caterkart.in' })).toThrow(
      /WEB_ORIGIN/,
    );
  });

  it.each(['RAZORPAY_WEBHOOK_SECRET', 'TWILLIO_AUTH_TOKEN', 'MONGO_URI', 'JWT_SECRET'])(
    'refuses to start without %s',
    (key) => {
      expect(() => validateEnvironment({ ...complete, [key]: '' })).toThrow(new RegExp(key));
    },
  );

  it('requires Redis once the placement queues are switched on', () => {
    expect(() => validateEnvironment({ ...complete, ENABLE_QUEUES: 'true', REDIS_URL: '' })).toThrow(
      /REDIS_URL/,
    );
  });

  it('only warns in development, so a partial local setup still runs', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).not.toThrow();
  });
});
