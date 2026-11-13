import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthedRequest } from '../auth/session.middleware';
import { CelebrationAccessService } from './celebration-access.service';

/**
 * Host-only access to a celebration, enforced BEFORE the handler runs.
 *
 * This exists for one route — the SSE stream — because checking inside the
 * handler is too late there. `@Sse` turns whatever the method returns into a
 * stream, and Nest commits `200 OK` and the event-stream headers the moment it
 * does; an observable that errors afterwards closes the connection, but the
 * caller has already been told they were allowed. Live-tested: a stranger with
 * a valid session got 200 on another host's stream until this guard went in.
 *
 * A guard runs in the request pipeline before any of that, so it can still
 * answer with a status code.
 *
 * Everywhere else the check stays in the service, where it cannot be lost by
 * someone adding a route and forgetting a decorator.
 */
@Injectable()
export class CelebrationHostGuard implements CanActivate {
  constructor(private readonly access: CelebrationAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest & { params: { id?: string } }>();

    const userId = req.ckUserId;
    if (!userId) throw new UnauthorizedException('Sign in with Swiggy to continue');

    // Throws 404 when the celebration is missing OR not theirs — the two are
    // deliberately indistinguishable. See CelebrationAccessService.
    await this.access.assertHost(String(req.params.id), userId);
    return true;
  }
}
