import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { NeedsReauthError } from '../mcp/mcp.errors';
import { maskString } from '../common/redact';

interface ServerMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
}

/** Swiggy's /auth/token response, for both the code and refresh grants. */
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

/**
 * Renew this long before the access token actually expires.
 *
 * A call that passes the freshness check still has to survive a full MCP
 * round-trip, and placements are non-idempotent — expiring mid-placement is
 * exactly the failure we cannot safely retry.
 */
const RENEW_BEFORE_MS = 5 * 60_000;

/**
 * Floor between renewal attempts for one user while their token is still valid.
 *
 * Swiggy hands back the current token until it genuinely expires, so retrying
 * inside the renewal window buys nothing — this stops that from becoming a
 * request per tool call for the last five minutes of every grant.
 */
const REFRESH_COOLDOWN_MS = 60_000;

/**
 * Stand-in until we learn the user's real name. The OAuth grant carries no
 * profile and the MCP exposes no tool that reports one, so this survives until
 * they save an address and tell us who they are.
 */
export const PLACEHOLDER_NAME = 'Swiggy user';

/**
 * How long a started sign-in may sit unfinished.
 *
 * An OAuthFlow row holds the PKCE verifier and the CSRF state for one handshake.
 * Swiggy's own authorization code lives about two minutes, so ten is generous
 * for a user who tabs away mid-login — and far short of forever, which is what
 * it used to be: rows were created on every sign-in attempt and only deleted on
 * success, so abandoned ones accumulated unbounded and stayed replayable.
 */
const OAUTH_FLOW_TTL_MS = 10 * 60_000;

/**
 * Whether a stored grant can still reach Swiggy.
 *
 * A held refresh token counts as connected even once the access token has
 * lapsed: the next call renews it silently. Reporting that as disconnected
 * would push the user through phone + OTP for a grant that still works.
 */
function isUsable(auth: { expiresAt: Date; refreshTokenEnc: string | null } | null | undefined): boolean {
  if (!auth) return false;
  return auth.expiresAt.getTime() > Date.now() || !!auth.refreshTokenEnc;
}

/**
 * Brokers the Swiggy MCP OAuth 2.1 + PKCE handshake on the user's behalf and
 * owns their access token. Tokens never reach the browser.
 *
 * Flow (live mode):
 *   1. begin()    → register a client (DCR), build /auth/authorize URL with a
 *                   PKCE challenge + state, persist the verifier.
 *   2. <browser>  → user does phone + OTP on Swiggy, redirected back with code.
 *   3. complete() → POST /auth/token (code + verifier) → access token (~5 days)
 *                   AND a refresh token, encrypt + store both.
 *
 * Swiggy now issues refresh tokens (verified live 2026-09-13), so an expired
 * access token is renewed silently instead of forcing the user back through
 * phone + OTP every 5 days. NeedsReauthError is now the narrow case: no grant
 * at all, a grant predating refresh tokens, or a refresh Swiggy rejected.
 */
@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);
  private metadata?: ServerMetadata;
  /** userId → in-flight refresh, so concurrent tool calls share one renewal. */
  private readonly refreshing = new Map<string, Promise<string>>();
  /** userId → last successful renewal, for the cooldown above. */
  private readonly lastRefresh = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Start an authorization. Returns the URL the browser should be sent to.
   *
   * `userId` is optional because this doubles as sign-up: a first-time visitor
   * has no account, and `complete()` creates one once Swiggy has actually
   * authenticated them. Creating it here would leave an orphan User row behind
   * every abandoned sign-in.
   */
  async begin(userId?: string, redirectAfter?: string): Promise<{ authorizeUrl: string }> {
    const safeRedirect = this.sanitizeRedirect(redirectAfter);
    const meta = await this.getMetadata();
    const clientId = await this.registerClient(meta);
    const verifier = this.crypto.pkceVerifier();
    const challenge = this.crypto.pkceChallenge(verifier);
    const state = this.crypto.randomState();

    await this.prisma.oAuthFlow.create({
      data: { state, codeVerifier: verifier, clientId, userId: userId ?? null, redirectAfter: safeRedirect },
    });

    const redirectUri = this.config.get<string>('mcp.oauth.redirectUri')!;
    const scope = this.config.get<string>('mcp.oauth.scope', 'mcp:tools');
    const url = new URL(meta.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', scope);
    return { authorizeUrl: url.toString() };
  }

  /** Handle the redirect back from Swiggy: exchange code → token. */
  async complete(code: string, state: string): Promise<{ userId: string; redirectAfter?: string }> {
    const flow = await this.prisma.oAuthFlow.findUnique({ where: { state } });
    if (!flow) throw new NeedsReauthError('unknown');

    // Single-use AND time-bound. Deleting first means a replay of the same
    // state — a stolen callback URL resent later — finds nothing, rather than
    // racing a second exchange against the same verifier.
    await this.prisma.oAuthFlow.delete({ where: { id: flow.id } }).catch(() => undefined);
    if (Date.now() - flow.createdAt.getTime() > OAUTH_FLOW_TTL_MS) {
      this.log.warn(`rejecting expired OAuth flow (age ${Date.now() - flow.createdAt.getTime()}ms)`);
      throw new NeedsReauthError(flow.userId ?? 'unknown');
    }

    const meta = await this.getMetadata();
    const redirectUri = this.config.get<string>('mcp.oauth.redirectUri')!;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: flow.clientId,
      code_verifier: flow.codeVerifier,
    });

    const res = await fetch(meta.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      // Scrubbed: an OAuth error body routinely echoes the parameters it was
      // sent, so a verbatim log of a failed exchange can write the live
      // authorization code and PKCE verifier to disk.
      this.log.error(`token exchange failed: ${res.status} ${maskString(await res.text())}`);
      throw new NeedsReauthError(flow.userId ?? 'unknown');
    }
    const token = (await res.json()) as TokenResponse;

    const userId = flow.userId ?? (await this.ensureAnonUser());
    await this.storeToken(
      userId,
      token.access_token,
      token.scope ?? this.config.get('mcp.oauth.scope', 'mcp:tools'),
      token.expires_in ?? 5 * 86400,
      undefined,
      flow.clientId,
      token.refresh_token,
    );
    return { userId, redirectAfter: flow.redirectAfter ?? undefined };
  }

  /**
   * Decrypted access token, renewing it first if it is close to expiry.
   *
   * NeedsReauthError now means the grant is genuinely unrecoverable: there is
   * no grant, or it predates refresh tokens, or Swiggy rejected the refresh.
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const auth = await this.prisma.swiggyAuth.findUnique({ where: { userId } });
    if (!auth) throw new NeedsReauthError(userId);

    const msLeft = auth.expiresAt.getTime() - Date.now();
    if (msLeft > RENEW_BEFORE_MS) return this.crypto.decrypt(auth.accessTokenEnc);

    const expired = msLeft <= 0;
    if (!auth.refreshTokenEnc) {
      // Grants predating refresh tokens: still usable until they actually lapse.
      if (!expired) return this.crypto.decrypt(auth.accessTokenEnc);
      throw new NeedsReauthError(userId);
    }

    // Verified live 2026-09-13: while the current token is still valid, Swiggy
    // answers a refresh with that SAME token and its REMAINING lifetime — an
    // early renewal does not push expiry out. So a token inside the renewal
    // window but not yet expired would re-hit the token endpoint on every
    // single call. Renew once, then coast on the result until it truly lapses.
    const since = Date.now() - (this.lastRefresh.get(userId) ?? 0);
    if (!expired && since < REFRESH_COOLDOWN_MS) return this.crypto.decrypt(auth.accessTokenEnc);

    return this.refreshAccessToken(userId, auth.refreshTokenEnc, auth.clientId);
  }

  /**
   * Renew an access token, collapsing concurrent callers onto one request.
   *
   * Without the in-flight map a checkout — which fans out across cart, coupons,
   * payment options and orders — would fire several refreshes at once. Swiggy
   * may rotate the refresh token, in which case the slowest response would
   * overwrite the newest one with a value Swiggy has already retired.
   */
  private refreshAccessToken(userId: string, refreshTokenEnc: string, clientId: string): Promise<string> {
    const inFlight = this.refreshing.get(userId);
    if (inFlight) return inFlight;

    const p = this.doRefresh(userId, refreshTokenEnc, clientId).finally(() => {
      this.refreshing.delete(userId);
    });
    this.refreshing.set(userId, p);
    return p;
  }

  private async doRefresh(userId: string, refreshTokenEnc: string, clientId: string): Promise<string> {
    const meta = await this.getMetadata();
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.crypto.decrypt(refreshTokenEnc),
      client_id: clientId,
    });

    const res = await fetch(meta.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      // The refresh token is spent or revoked. Clear it so every later call
      // fails fast into re-auth instead of retrying a grant Swiggy has refused.
      this.log.warn(`refresh failed for ${userId}: ${res.status} ${maskString(await res.text())}`);
      await this.prisma.swiggyAuth
        .updateMany({ where: { userId }, data: { refreshTokenEnc: null } })
        .catch(() => undefined);
      throw new NeedsReauthError(userId);
    }

    // Swiggy's refresh response carries no `scope` (verified live), so the
    // configured default stands in rather than blanking the stored value.
    const token = (await res.json()) as TokenResponse;
    await this.storeToken(
      userId,
      token.access_token,
      token.scope ?? this.config.get('mcp.oauth.scope', 'mcp:tools'),
      token.expires_in ?? 5 * 86400,
      undefined,
      clientId,
      token.refresh_token,
    );
    this.lastRefresh.set(userId, Date.now());
    return token.access_token;
  }

  /** The signed-in user plus the state of their Swiggy grant. */
  async session(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { swiggyAuth: true },
    });
    if (!user) throw new NeedsReauthError(userId);

    const auth = user.swiggyAuth;
    const live = isUsable(auth);
    return {
      user: {
        id: user.id,
        name: user.displayName ?? PLACEHOLDER_NAME,
        phone: auth?.swiggyUserHint ?? null,
      },
      swiggy: { connected: live, expiresAt: live ? auth!.expiresAt : undefined },
    };
  }

  async isConnected(userId: string): Promise<{ connected: boolean; expiresAt?: Date }> {
    const auth = await this.prisma.swiggyAuth.findUnique({ where: { userId } });
    if (!isUsable(auth)) return { connected: false };
    return { connected: true, expiresAt: auth!.expiresAt };
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.swiggyAuth.deleteMany({ where: { userId } });
  }

  /**
   * Sweep handshakes nobody came back to finish.
   *
   * Hourly rather than on-write: the table is tiny, and a sweep on the sign-in
   * path would put a delete on the latency-sensitive side of a login. The TTL
   * check in `complete()` is what makes an un-swept row harmless; this is
   * housekeeping, not a security control.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepExpiredFlows(): Promise<void> {
    try {
      const { count } = await this.prisma.oAuthFlow.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - OAUTH_FLOW_TTL_MS) } },
      });
      if (count) this.log.log(`swept ${count} abandoned OAuth flow(s)`);
    } catch (err) {
      // A sweep that cannot run is not worth failing anything over.
      this.log.warn(`OAuth flow sweep failed: ${(err as Error).message}`);
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /**
   * Keep only a redirect target that points back at our own web app.
   *
   * `redirectAfter` arrives in a request body and ends up in `res.redirect()`.
   * Unchecked, that is an open redirect: a crafted sign-in link would deposit
   * the user on an attacker's page immediately after a genuine Swiggy login,
   * at the moment they are most likely to trust what they are looking at.
   *
   * Relative paths are allowed and resolved against the configured origin, so
   * the common case ("come back to /create") needs no allowlist entry.
   */
  sanitizeRedirect(target?: string): string | null {
    if (!target) return null;
    const web = this.config.get<string>('webOrigin', 'http://localhost:5173');
    try {
      const base = new URL(web);
      const url = new URL(target, base);
      // Compare the full origin: scheme, host AND port. A host-only check would
      // accept http:// for an https:// app.
      return url.origin === base.origin ? url.toString() : null;
    } catch {
      return null;
    }
  }

  private async storeToken(
    userId: string,
    accessToken: string,
    scope: string,
    expiresInSec: number,
    hint: string | undefined,
    clientId: string,
    refreshToken?: string,
  ): Promise<void> {
    // SwiggyAuth.userId is a FK to User.id. `complete()` creates the row for a
    // first-time sign-in, but an existing session re-authorising an expired
    // grant may name a user that was pruned — upsert rather than 500 on the FK.
    await this.prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, displayName: PLACEHOLDER_NAME },
      update: {},
    });

    const enc = this.crypto.encrypt(accessToken);
    const expiresAt = new Date(Date.now() + expiresInSec * 1000);
    // `undefined` is how Prisma is told "leave this column alone". A refresh
    // response that omits refresh_token means Swiggy did not rotate it, so the
    // stored one is still the live one — writing null there would strand the
    // user on a full re-auth at the next expiry. Same for an omitted hint.
    const refreshEnc = refreshToken ? this.crypto.encrypt(refreshToken) : undefined;
    await this.prisma.swiggyAuth.upsert({
      where: { userId },
      create: {
        userId,
        clientId,
        accessTokenEnc: enc,
        refreshTokenEnc: refreshEnc ?? null,
        scope,
        expiresAt,
        swiggyUserHint: hint,
      },
      update: {
        clientId,
        accessTokenEnc: enc,
        refreshTokenEnc: refreshEnc,
        scope,
        expiresAt,
        swiggyUserHint: hint,
      },
    });
  }

  /**
   * Discover Swiggy's OAuth endpoints — and refuse any that are not Swiggy's.
   *
   * The discovery document is fetched from the MCP server and tells us where to
   * send the authorization code, the PKCE verifier and, later, the refresh
   * token. Trusting it unconditionally means the MCP server picks the host that
   * receives those credentials: a compromised or DNS-hijacked mcp.swiggy.com
   * could return `token_endpoint: https://attacker.example/t` and we would POST
   * a live grant to it. This is the failure described in the MCP SDK's own
   * advisory (GHSA — "OAuth client could send credentials to an authorization
   * server chosen by the MCP server").
   *
   * So every discovered URL must be https and share the configured MCP origin.
   * Anything else falls back to the documented defaults, which are derived from
   * that same configured origin and therefore cannot be redirected at all.
   */
  private async getMetadata(): Promise<ServerMetadata> {
    if (this.metadata) return this.metadata;

    const base = this.config.get<string>('mcp.baseUrl', 'https://mcp.swiggy.com');
    const defaults: ServerMetadata = {
      authorization_endpoint: `${base}/auth/authorize`,
      token_endpoint: `${base}/auth/token`,
      registration_endpoint: `${base}/auth/register`,
    };

    try {
      const res = await fetch(`${base}/.well-known/oauth-authorization-server`);
      if (res.ok) {
        const discovered = (await res.json()) as Partial<ServerMetadata>;
        this.metadata = this.vetMetadata(discovered, base, defaults);
        return this.metadata;
      }
    } catch (e) {
      this.log.warn(`metadata discovery failed, using documented defaults: ${maskString(String(e))}`);
    }

    this.metadata = defaults;
    return this.metadata;
  }

  /** Keep only discovered endpoints that live on the configured MCP origin. */
  private vetMetadata(
    discovered: Partial<ServerMetadata>,
    base: string,
    defaults: ServerMetadata,
  ): ServerMetadata {
    const expected = new URL(base).origin;

    const sameOrigin = (candidate: string | undefined, fallback: string, field: string): string => {
      if (!candidate) return fallback;
      try {
        const url = new URL(candidate);
        // Origin, not hostname: https vs http and a different port are both
        // different places to send a credential.
        if (url.protocol === 'https:' && url.origin === expected) return candidate;
        this.log.error(
          `OAuth discovery proposed an off-origin ${field} (${url.origin}); expected ${expected}. Ignoring it.`,
        );
      } catch {
        this.log.error(`OAuth discovery returned an unparseable ${field}. Ignoring it.`);
      }
      return fallback;
    };

    return {
      authorization_endpoint: sameOrigin(
        discovered.authorization_endpoint,
        defaults.authorization_endpoint,
        'authorization_endpoint',
      ),
      token_endpoint: sameOrigin(discovered.token_endpoint, defaults.token_endpoint, 'token_endpoint'),
      registration_endpoint: sameOrigin(
        discovered.registration_endpoint,
        defaults.registration_endpoint!,
        'registration_endpoint',
      ),
    };
  }

  /** Dynamic Client Registration (RFC 7591). */
  private async registerClient(meta: ServerMetadata): Promise<string> {
    const endpoint = meta.registration_endpoint ?? `${this.config.get('mcp.baseUrl')}/auth/register`;
    const redirectUri = this.config.get<string>('mcp.oauth.redirectUri')!;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'CaterKart',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none', // public client + PKCE
        scope: this.config.get('mcp.oauth.scope', 'mcp:tools'),
      }),
    });
    // The message reaches the error filter, and from there a log line — scrub
    // it for the same reason as the token-exchange body above.
    if (!res.ok) throw new Error(`DCR failed: ${res.status} ${maskString(await res.text())}`);
    const reg = (await res.json()) as { client_id: string };
    return reg.client_id;
  }

  private async ensureAnonUser(): Promise<string> {
    const u = await this.prisma.user.create({ data: { displayName: PLACEHOLDER_NAME } });
    return u.id;
  }
}
