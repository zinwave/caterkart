import { Controller, Param, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CelebrationHostGuard } from '../celebrations/celebration-host.guard';
import { EventsService, CelebrationEvent } from './events.service';

@Controller('celebrations')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /**
   * Live order/settlement updates for a celebration.
   *
   * Host-only. The stream carries placement results, rider tracking and
   * settlement changes — the same data `GET /celebrations/:id` returns, pushed
   * rather than polled — so leaving it open was that disclosure with a
   * longer-lived connection.
   *
   * The check is a guard, not a line in this method: @Sse commits 200 and the
   * event-stream headers as soon as the handler returns an observable, so an
   * in-handler check cannot produce a status code. The browser authenticates
   * with the ordinary session cookie, which EventSource sends when it is opened
   * with `withCredentials` (see api.ts).
   */
  @UseGuards(CelebrationHostGuard)
  @Sse(':id/stream')
  stream(@Param('id') id: string): Observable<{ data: CelebrationEvent }> {
    return this.events.forCelebration(id);
  }
}
