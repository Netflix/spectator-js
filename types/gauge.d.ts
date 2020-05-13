import { Measurement } from './global';
import MeterId = require('./meter_id');

declare class Gauge {
  constructor(id: MeterId);
  set(value: number): void;
  get(): number;
  measure(): [] | [Measurement];
}

export = Gauge;
