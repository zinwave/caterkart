import { Global, Module } from '@nestjs/common';
import { CelebrationAccessService } from './celebration-access.service';
import { CelebrationHostGuard } from './celebration-host.guard';

/**
 * The celebration ownership check, available everywhere.
 *
 * Global so every place that handles a celebration id — celebrations,
 * settlement, invites, scheduler, the SSE stream — can inject it without an
 * import, and without the cycles that hanging it off CelebrationsModule would
 * create.
 *
 * It lives in its own file rather than beside the service because the guard
 * imports the service and the module imports the guard: with all three in one
 * file that is a genuine circular import, and Nest refuses to build the graph.
 */
@Global()
@Module({
  providers: [CelebrationAccessService, CelebrationHostGuard],
  exports: [CelebrationAccessService, CelebrationHostGuard],
})
export class CelebrationAccessModule {}
