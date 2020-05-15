import { Measurement } from './global';
import MeterId = require('./meter_id');

declare class Timer {
  constructor(id: MeterId);
  record(seconds: number | number[], nanos?: number): void;
  measure(): [] | [Measurement, Measurement, Measurement, Measurement];
}

export = Timer;
