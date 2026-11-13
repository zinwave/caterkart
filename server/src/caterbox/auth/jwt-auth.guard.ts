import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY, AuthUser } from './decorators';

/** Route surface this guard governs. Everything under it is fail-closed. */
export const CK_PREFIX = '/api/ck';

/**
 * Authentication guard for the CaterBox surface (fail-closed): every /api/ck
 * route requires a valid Bearer JWT unless explicitly marked @Public(). On
 * success the decoded user is attached to `req.user` for downstream guards.
 *
 * It is registered app-wide (APP_GUARD) so a new CaterBox controller is
 * protected by default — the whole point of a fail-closed guard is that you
 * cannot forget it. But this app also serves the Swiggy/Celebrations routes,
 * which authenticate with a cookie session resolved by SessionMiddleware and
 * carry no Bearer token. So the guard first checks jurisdiction and stands
 * aside for anything outside /api/ck, rather than 401-ing the other half of
 * the product.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();

    // Not our surface — the Swiggy half authenticates via cookie session.
    const path: string = req.originalUrl || req.url || '';
    if (!path.startsWith(CK_PREFIX)) return true;

    const header: string = req.headers?.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    try {
      const payload = this.jwt.verify<AuthUser & { iat?: number; exp?: number }>(token);
      req.user = {
        phone: payload.phone,
        isAdmin: !!payload.isAdmin,
        type: payload.type,
        vendorName: payload.vendorName,
        name: payload.name,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
