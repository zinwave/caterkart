/** Typed view over process.env, with sane defaults for local dev. */

export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',

  session: {
    // The Swiggy grant lasts ~5 days with no refresh, so the app session
    // deliberately outlives it: signing in again re-links the grant without
    // losing the account, its celebrations or its order history.
    ttlDays: parseInt(process.env.SESSION_TTL_DAYS ?? '30', 10),
  },
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  mcp: {
    baseUrl: process.env.MCP_BASE_URL ?? 'https://mcp.swiggy.com',
    paths: {
      food: process.env.MCP_FOOD_PATH ?? '/food',
      instamart: process.env.MCP_INSTAMART_PATH ?? '/im',
      dineout: process.env.MCP_DINEOUT_PATH ?? '/dineout',
    },
    oauth: {
      redirectUri:
        process.env.MCP_OAUTH_REDIRECT_URI ??
        'http://localhost:4000/auth/swiggy/callback',
      scope: process.env.MCP_OAUTH_SCOPE ?? 'mcp:tools',
    },
  },

  secrets: {
    tokenEncKey: process.env.TOKEN_ENC_KEY ?? '',
    appJwtSecret: process.env.APP_JWT_SECRET ?? 'dev-secret',
  },

  orchestration: {
    foodOrderCapRupees: parseInt(process.env.FOOD_ORDER_CAP_RUPEES ?? '1000', 10),
    trackingPollMinMs: parseInt(process.env.TRACKING_POLL_MIN_MS ?? '10000', 10),
    convergenceToleranceMin: parseInt(process.env.CONVERGENCE_TOLERANCE_MIN ?? '5', 10),
    preDropLeadMin: parseInt(process.env.PREDROP_LEAD_MIN ?? '15', 10),
  },
});
