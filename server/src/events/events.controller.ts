import { Controller, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventsService, CelebrationEvent } from './events.service';

@Controller('celebrations')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** Live order/settlement updates for a celebration (EventSource on the web). */
  @Sse(':id/stream')
  stream(@Param('id') id: string): Observable<{ data: CelebrationEvent }> {
    return this.events.forCelebration(id);
  }
}
