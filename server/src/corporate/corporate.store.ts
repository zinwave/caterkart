import { Injectable } from '@nestjs/common';
import { seedState } from './corporate.data';
import type { CorporateState } from './corporate.types';

/**
 * The persistence seam. Services read `state` and wrap every mutation in
 * `mutate(fn)`. In mock mode this is an in-memory object; a future
 * PrismaCorporateStore implements the same surface against Postgres — flip the
 * provider in corporate.module.ts, touch nothing else.
 */
export abstract class CorporateStore {
  abstract get state(): CorporateState;
  /** Apply a mutation and (for durable stores) persist it. */
  abstract mutate<T>(fn: (s: CorporateState) => T): T;
}

@Injectable()
export class InMemoryCorporateStore extends CorporateStore {
  private _state: CorporateState = seedState();

  get state(): CorporateState {
    return this._state;
  }

  mutate<T>(fn: (s: CorporateState) => T): T {
    // In-memory: the state object is mutated in place; nothing to flush.
    return fn(this._state);
  }

  /** Test/dev hook. */
  reset(): void {
    this._state = seedState();
  }
}
