import { AuthService } from './auth.service';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import type { CryptoService } from '../common/crypto.service';

/**
 * The discovery document tells this service where to send the authorization
 * code, the PKCE verifier and the refresh token. It is fetched FROM the MCP
 * server, so an unvalidated one lets that server nominate who receives a live
 * Swiggy grant.
 */
describe('AuthService — OAuth endpoint discovery', () => {
  const BASE = 'https://mcp.swiggy.com';

  function build() {
    const config = {
      get: (key: string, fallback?: unknown) =>
        ({ 'mcp.baseUrl': BASE, 'mcp.oauth.scope': 'mcp:tools', webOrigin: 'https://caterkart.in' })[
          key
        ] ?? fallback,
    } as unknown as ConfigService;

    const service = new AuthService(
      config,
      {} as PrismaService,
      {} as CryptoService,
    );
    jest.spyOn((service as never as { log: { warn: () => void; error: () => void } }).log, 'warn').mockImplementation(() => undefined);
    const error = jest
      .spyOn((service as never as { log: { error: () => void } }).log, 'error')
      .mockImplementation(() => undefined);
    return { service, error };
  }

  /** Reach the private method the way the OAuth flow does. */
  const metadata = (s: AuthService) =>
    (s as never as { getMetadata: () => Promise<Record<string, string>> }).getMetadata();

  const respondWith = (body: unknown) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body }) as never;
  };

  afterEach(() => jest.restoreAllMocks());

  it('accepts endpoints served from the configured MCP origin', async () => {
    respondWith({
      authorization_endpoint: `${BASE}/auth/authorize`,
      token_endpoint: `${BASE}/auth/token`,
      registration_endpoint: `${BASE}/auth/register`,
    });
    const { service } = build();

    await expect(metadata(service)).resolves.toMatchObject({
      token_endpoint: `${BASE}/auth/token`,
    });
  });

  it('refuses a token endpoint on an attacker-controlled host', async () => {
    respondWith({
      authorization_endpoint: `${BASE}/auth/authorize`,
      token_endpoint: 'https://attacker.example/steal',
    });
    const { service, error } = build();

    const meta = await metadata(service);

    // Falls back to the endpoint derived from our own configured origin.
    expect(meta.token_endpoint).toBe(`${BASE}/auth/token`);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('off-origin token_endpoint'));
  });

  it('refuses an http:// endpoint even on the right host', async () => {
    respondWith({ token_endpoint: 'http://mcp.swiggy.com/auth/token' });
    const { service } = build();

    await expect(metadata(service)).resolves.toMatchObject({
      token_endpoint: `${BASE}/auth/token`,
    });
  });

  it('refuses a look-alike host', async () => {
    respondWith({ token_endpoint: 'https://mcp.swiggy.com.evil.example/auth/token' });
    const { service } = build();

    await expect(metadata(service)).resolves.toMatchObject({
      token_endpoint: `${BASE}/auth/token`,
    });
  });

  it('falls back to the documented defaults when discovery is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ENOTFOUND')) as never;
    const { service } = build();

    await expect(metadata(service)).resolves.toEqual({
      authorization_endpoint: `${BASE}/auth/authorize`,
      token_endpoint: `${BASE}/auth/token`,
      registration_endpoint: `${BASE}/auth/register`,
    });
  });

  it('ignores an unparseable endpoint rather than throwing', async () => {
    respondWith({ token_endpoint: 'not a url' });
    const { service } = build();

    await expect(metadata(service)).resolves.toMatchObject({
      token_endpoint: `${BASE}/auth/token`,
    });
  });
});
