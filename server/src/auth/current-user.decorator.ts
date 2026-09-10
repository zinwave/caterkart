import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthedRequest } from './session.middleware';

/**
 * Resolves the app user from the signed session cookie, which SessionMiddleware
 * has already verified for this request.
 *
 * This used to trust an `x-user-id` header, defaulting to "dev-user". That was
 * an account-takeover hole, not merely a scaffold: the header names whose
 * Swiggy grant the backend will use, so any caller could send someone else's id
 * and place real food orders on their account. The cookie is HMAC-signed and
 * set only by the OAuth callback, so it cannot be chosen by the client.
 */
function resolve(ctx: ExecutionContext): string | null {
  return ctx.switchToHttp().getRequest<AuthedRequest>().ckUserId ?? null;
}

/** The signed-in user. Rejects the request with 401 when there is no session. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const uid = resolve(ctx);
  if (!uid) throw new UnauthorizedException('Sign in with Swiggy to continue');
  return uid;
});

/**
 * The signed-in user, or null.
 *
 * For the one endpoint that must work both ways: `POST /auth/swiggy/begin` is
 * how a new visitor signs in, so it cannot require a session — but an existing
 * user re-authorising an expired grant should keep their identity rather than
 * silently becoming a new account with an empty order history.
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => resolve(ctx),
);
