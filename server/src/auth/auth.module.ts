import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { SessionMiddleware } from './session.middleware';
import { CryptoService } from '../common/crypto.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, SessionMiddleware, CryptoService],
  // SessionService and SessionMiddleware are exported so AppModule can apply
  // the middleware globally — identity has to be resolved for every route, not
  // just the ones in this module.
  exports: [AuthService, SessionService, SessionMiddleware],
})
export class AuthModule {}
