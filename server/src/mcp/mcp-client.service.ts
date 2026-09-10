import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AuthService } from '../auth/auth.service';
import { NeedsReauthError, PlacementFailedError, ToolError } from './mcp.errors';
import type { ServerKey } from './mcp.types';

export interface CallOpts {
  /** Idempotent calls retry on transient failure; placements never do. */
  idempotent?: boolean;
  /** Max attempts for idempotent calls (default 3). */
  maxAttempts?: number;
}

/** One reused MCP session per (server, user, token). */
interface PooledClient {
  token: string;
  lastUsed: number;
  client?: Client;
  transport?: StreamableHTTPClientTransport;
  /** In-flight connect, so concurrent callers share ONE handshake. */
  connecting?: Promise<Client>;
}

const IDLE_MS = 5 * 60_000; // close sessions unused for 5 min

/**
 * The single choke point for every Swiggy MCP tool call.
 *
 * Sessions are POOLED and reused. Opening an MCP session authenticates the
 * bearer token with Swiggy, so a fresh connection per tool call meant dozens of
 * auth validations per checkout. Instead we keep one authenticated session per
 * (server, user) alive and run every tool call over it — reconnecting only when
 * the token rotates, the session errors, or it goes idle.
 *
 * Retry policy is decided HERE so non-idempotent placements can never be
 * silently retried (Swiggy: place_food_order is not idempotent).
 */
@Injectable()
export class McpClientService implements OnModuleDestroy {
  private readonly log = new Logger(McpClientService.name);
  private readonly pool = new Map<string, PooledClient>();
  private readonly sweeper: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {
    this.sweeper = setInterval(() => this.sweepIdle(), 60_000);
    this.sweeper.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.sweeper);
    await Promise.all([...this.pool.keys()].map((k) => this.evict(k)));
  }

  async callTool<T>(
    server: ServerKey,
    userId: string,
    toolName: string,
    params: Record<string, unknown>,
    opts: CallOpts = {},
  ): Promise<T> {
    const idempotent = opts.idempotent ?? true;
    const maxAttempts = idempotent ? opts.maxAttempts ?? 3 : 1;

    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.callLive<T>(server, userId, toolName, params);
      } catch (err) {
        lastErr = err;
        if (err instanceof NeedsReauthError) throw err; // re-auth, never retry
        // A ToolError is Swiggy deliberately refusing (bad coupon, cart too small).
        // Retrying just repeats the same refusal — surface it immediately.
        if (err instanceof ToolError) throw err;
        if (!idempotent) throw new PlacementFailedError(toolName, err); // unsafe to retry
        if (attempt < maxAttempts) {
          const backoff = 250 * 2 ** (attempt - 1);
          this.log.warn(`${toolName} attempt ${attempt} failed, retrying in ${backoff}ms`);
          await sleep(backoff);
        }
      }
    }
    throw lastErr;
  }

  // ── Live transport (pooled) ───────────────────────────────────────────────
  private async callLive<T>(
    server: ServerKey,
    userId: string,
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const accessToken = await this.auth.getValidAccessToken(userId); // throws NeedsReauthError
    const key = `${server}:${userId}`;

    try {
      const client = await this.getClient(server, key, accessToken);
      const res = await client.callTool({ name: toolName, arguments: params });
      if (res.isError) {
        // Swiggy puts the human-readable reason ("Coupon does not exist", "Add
        // ₹610 more…") in the text content. Surface it for LOGS and coupon-style
        // flows — the UI layer decides whether to show it. The session is fine,
        // so we keep it pooled.
        const content = res.content as Array<{ type: string; text?: string }> | undefined;
        const reason = content?.find((c) => c.type === 'text')?.text?.split('\n')[0];
        throw new ToolError(toolName, reason ?? `MCP tool ${toolName} failed`);
      }
      return this.unwrap<T>(res as { structuredContent?: unknown; content?: unknown });
    } catch (err) {
      if (err instanceof ToolError) throw err; // deliberate refusal — session healthy
      // Anything else means the session may be dead: drop it so the next call
      // (or retry) reconnects instead of hammering a broken session.
      await this.evict(key);
      if (isUnauthorized(err)) throw new NeedsReauthError(userId);
      throw err;
    }
  }

  /**
   * A live, authenticated MCP client for this (server, user). Reuses the pooled
   * session unless the token rotated; dedupes concurrent connects.
   */
  private async getClient(server: ServerKey, key: string, token: string): Promise<Client> {
    const cur = this.pool.get(key);
    if (cur && cur.token === token) {
      if (cur.connecting) return cur.connecting; // a connect is already in flight
      if (cur.client) {
        cur.lastUsed = Date.now();
        return cur.client;
      }
    }
    if (cur) await this.evict(key); // token rotated or half-open entry → reconnect

    const entry: PooledClient = { token, lastUsed: Date.now() };
    entry.connecting = (async () => {
      const transport = new StreamableHTTPClientTransport(new URL(this.serverUrl(server)), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      });
      const client = new Client({ name: 'caterkart', version: '0.1.0' });
      await client.connect(transport);
      entry.client = client;
      entry.transport = transport;
      entry.connecting = undefined;
      entry.lastUsed = Date.now();
      return client;
    })();
    this.pool.set(key, entry);
    try {
      return await entry.connecting;
    } catch (e) {
      this.pool.delete(key); // failed handshake — don't cache it
      throw e;
    }
  }

  private async evict(key: string): Promise<void> {
    const e = this.pool.get(key);
    this.pool.delete(key);
    if (e?.client) await e.client.close().catch(() => undefined);
  }

  private sweepIdle(): void {
    const now = Date.now();
    for (const [key, e] of this.pool) {
      if (!e.connecting && now - e.lastUsed > IDLE_MS) void this.evict(key);
    }
  }

  /**
   * Swiggy puts the real payload in `structuredContent`, keyed by entity —
   * e.g. `{ restaurants: [...] }` — NOT under a `data` envelope (verified live
   * 2026-07-13). The `content` text block is LLM-facing prose, so it is only a
   * fallback for tools that return no structured content (e.g. get_addresses).
   */
  private unwrap<T>(res: { structuredContent?: unknown; content?: unknown }): T {
    const sc = res.structuredContent as Record<string, unknown> | undefined;
    if (sc && typeof sc === 'object' && Object.keys(sc).length > 0) {
      return ('data' in sc ? sc.data : sc) as T;
    }

    const content = res.content as Array<{ type: string; text?: string }> | undefined;
    const text = content?.find((c) => c.type === 'text')?.text;
    if (text) {
      try {
        const parsed = JSON.parse(text);
        return (parsed?.data ?? parsed) as T;
      } catch {
        return text as unknown as T;
      }
    }
    return res as unknown as T;
  }

  private serverUrl(server: ServerKey): string {
    const base = this.config.get<string>('mcp.baseUrl', 'https://mcp.swiggy.com');
    const path = this.config.get<string>(`mcp.paths.${server}`)!;
    return `${base}${path}`;
  }

}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isUnauthorized(err: unknown): boolean {
  const s = String((err as { message?: string })?.message ?? err);
  return /401|unauthor|invalid_token|expired/i.test(s);
}
