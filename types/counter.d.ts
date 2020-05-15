import { Measurement } from './global';
import MeterId = require('./meter_id');

declare class Counter {
  id: MeterId;
  count: number;
  constructor(id: MeterId);
  add(amount?: number): void;
  increment(amount?: number): void;
  measure(): [] | [Measurement];
}

export = Counter;
