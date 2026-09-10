import { Body, Controller, Get, Logger, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { CurrentUser, OptionalUser } from './current-user.decorator';

/**
 * Swiggy OAuth 2.1 + PKCE, brokered server-side. Tokens never reach the browser.
 *
 * This is also the app's only sign-in. There is no separate phone + OTP step:
 * Swiggy already authenticates the user with exactly that, and asking twice
 * would collect a phone number we have no way to verify and no reason to hold.
 * Completing the grant is what creates the session.
 *
 * Note: `GET /auth/swiggy/callback` is excluded from the global `/api` prefix
 * (see main.ts) because the redirect URI registered with Swiggy is the bare
 * path. Everything else lives under `/api/auth/swiggy/*`.
 */
@Controller('auth/swiggy')
export class AuthController {
  private readonly log = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Kick off authorization; the frontend sends the browser to the returned URL.
   *
   * Deliberately open to anonymous callers — this is the sign-in entry point.
   * An existing session is carried through so re-authorising an expired grant
   * keeps the same account and its order history.
   */
  @Post('begin')
  begin(@OptionalUser() userId: string | null, @Body('redirectAfter') redirectAfter?: string) {
    return this.auth.begin(userId ?? undefined, redirectAfter);
  }

  /** Who is signed in, and whether their Swiggy grant is still live. */
  @Get('session')
  async session(@CurrentUser() userId: string) {
    return this.auth.session(userId);
  }

  @Get('status')
  status(@CurrentUser() userId: string) {
    return this.auth.isConnected(userId);
  }

  /**
   * Drop the Swiggy grant but keep the account.
   *
   * Distinct from logout: the celebrations, guests and settlements belong to the
   * app user, not to the grant, so revoking Swiggy access must not orphan them.
   */
  @Post('disconnect')
  async disconnect(@CurrentUser() userId: string) {
    await this.auth.disconnect(userId);
    return { ok: true };
  }

  /** End the app session. The Swiggy grant is left intact for the next sign-in. */
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.sessions.clear(res);
    return { ok: true };
  }

  /** OAuth redirect target. Exchanges the code, opens a session, bounces back. */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('redirectAfter') redirectAfterQ: string | undefined,
    @Res() res: Response,
  ) {
    const web = this.config.get<string>('webOrigin', 'http://localhost:5173');
    try {
      const { userId, redirectAfter } = await this.auth.complete(code, state);
      // Completing the grant IS the sign-in — the user has just proven they own
      // a Swiggy account, which is the only identity this app has.
      this.sessions.attach(res, userId);
      // Both candidates are re-checked here, not just the stored one: the query
      // parameter is attacker-controllable on this very request.
      const target =
        this.auth.sanitizeRedirect(redirectAfter) ??
        this.auth.sanitizeRedirect(redirectAfterQ) ??
        `${web}/?swiggy=connected`;
      res.redirect(target);
    } catch (err) {
      // Never swallow this: a silent redirect to ?swiggy=error is undebuggable.
      this.log.error(`Swiggy OAuth callback failed: ${(err as Error)?.message}`, (err as Error)?.stack);
      const reason = encodeURIComponent((err as Error)?.message ?? 'unknown');
      res.redirect(`${web}/?swiggy=error&reason=${reason}`);
    }
  }
}
