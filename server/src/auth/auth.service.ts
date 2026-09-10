import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { NeedsReauthError } from '../mcp/mcp.errors';

interface ServerMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
}

/**
 * Brokers the Swiggy MCP OAuth 2.1 + PKCE handshake on the user's behalf and
 * owns their access token. Tokens never reach the browser.
 *
 * Flow (live mode):
 *   1. begin()    → register a client (DCR), build /auth/authorize URL with a
 *                   PKCE challenge + state, persist the verifier.
 *   2. <browser>  → user does phone + OTP on Swiggy, redirected back with code.
 *   3. complete() → POST /auth/token (code + verifier) → access token (~5 days,
 *                   no refresh), encrypt + store.
 *
 * On a 401 anywhere, callers get NeedsReauthError and must restart at step 1.
 */
@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);
  private metadata?: ServerMetadata;

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
      this.log.error(`token exchange failed: ${res.status} ${await res.text()}`);
      throw new NeedsReauthError(flow.userId ?? 'unknown');
    }
    const token = (await res.json()) as { access_token: string; expires_in?: number; scope?: string };

    const userId = flow.userId ?? (await this.ensureAnonUser());
    await this.storeToken(
      userId,
      token.access_token,
      token.scope ?? this.config.get('mcp.oauth.scope', 'mcp:tools'),
      token.expires_in ?? 5 * 86400,
      undefined,
      flow.clientId,
    );
    await this.prisma.oAuthFlow.delete({ where: { id: flow.id } }).catch(() => undefined);
    return { userId, redirectAfter: flow.redirectAfter ?? undefined };
  }

  /** Decrypted access token, or NeedsReauthError if missing/expired. */
  async getValidAccessToken(userId: string): Promise<string> {
    const auth = await this.prisma.swiggyAuth.findUnique({ where: { userId } });
    if (!auth) throw new NeedsReauthError(userId);
    // Doc: proactively re-auth when <= 60s remain (no refresh token in v1).
    if (auth.expiresAt.getTime() <= Date.now() + 60_000) throw new NeedsReauthError(userId);
    return this.crypto.decrypt(auth.accessTokenEnc);
  }

  /** The signed-in user plus the state of their Swiggy grant. */
  async session(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { swiggyAuth: true },
    });
    if (!user) throw new NeedsReauthError(userId);

    const auth = user.swiggyAuth;
    const live = !!auth && auth.expiresAt.getTime() > Date.now();
    return {
      user: {
        id: user.id,
        name: user.displayName ?? 'Swiggy user',
        phone: auth?.swiggyUserHint ?? null,
      },
      swiggy: { connected: live, expiresAt: live ? auth!.expiresAt : undefined },
    };
  }

  async isConnected(userId: string): Promise<{ connected: boolean; expiresAt?: Date }> {
    const auth = await this.prisma.swiggyAuth.findUnique({ where: { userId } });
    if (!auth || auth.expiresAt.getTime() <= Date.now()) return { connected: false };
    return { connected: true, expiresAt: auth.expiresAt };
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.swiggyAuth.deleteMany({ where: { userId } });
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
  ): Promise<void> {
    // SwiggyAuth.userId is a FK to User.id. `complete()` creates the row for a
    // first-time sign-in, but an existing session re-authorising an expired
    // grant may name a user that was pruned — upsert rather than 500 on the FK.
    await this.prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, displayName: 'Swiggy user' },
      update: {},
    });

    const enc = this.crypto.encrypt(accessToken);
    const expiresAt = new Date(Date.now() + expiresInSec * 1000);
    await this.prisma.swiggyAuth.upsert({
      where: { userId },
      create: { userId, clientId, accessTokenEnc: enc, scope, expiresAt, swiggyUserHint: hint },
      update: { clientId, accessTokenEnc: enc, scope, expiresAt, swiggyUserHint: hint },
    });
  }

  private async getMetadata(): Promise<ServerMetadata> {
    if (this.metadata) return this.metadata;
    const base = this.config.get<string>('mcp.baseUrl', 'https://mcp.swiggy.com');
    try {
      const res = await fetch(`${base}/.well-known/oauth-authorization-server`);
      if (res.ok) {
        this.metadata = (await res.json()) as ServerMetadata;
        return this.metadata;
      }
    } catch (e) {
      this.log.warn(`metadata discovery failed, using documented defaults: ${e}`);
    }
    this.metadata = {
      authorization_endpoint: `${base}/auth/authorize`,
      token_endpoint: `${base}/auth/token`,
      registration_endpoint: `${base}/auth/register`,
    };
    return this.metadata;
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
    if (!res.ok) throw new Error(`DCR failed: ${res.status} ${await res.text()}`);
    const reg = (await res.json()) as { client_id: string };
    return reg.client_id;
  }

  private async ensureAnonUser(): Promise<string> {
    const u = await this.prisma.user.create({ data: { displayName: 'Swiggy user' } });
    return u.id;
  }
}
