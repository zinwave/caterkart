import { Injectable } from '@nestjs/common';
import { Subject, Observable, filter, map } from 'rxjs';

export interface CelebrationEvent {
  celebrationId: string;
  type:
    | 'suborder.updated'
    | 'suborder.placed'
    | 'suborder.failed'
    | 'tracking'
    | 'plan.computed'
    | 'settlement.updated';
  payload: unknown;
  at: string;
}

/**
 * In-process pub/sub that fans backend state changes out to the browser over
 * SSE. For multi-instance deploys, back this with the existing Redis (BullMQ)
 * via a pub/sub channel — the public surface stays the same.
 */
@Injectable()
export class EventsService {
  private readonly stream = new Subject<CelebrationEvent>();

  emit(e: Omit<CelebrationEvent, 'at'>): void {
    this.stream.next({ ...e, at: new Date().toISOString() });
  }

  /** SSE payloads for one celebration. */
  forCelebration(celebrationId: string): Observable<{ data: CelebrationEvent }> {
    return this.stream.pipe(
      filter((e) => e.celebrationId === celebrationId),
      map((e) => ({ data: e })),
    );
  }
}
