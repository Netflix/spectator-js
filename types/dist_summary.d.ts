import { Measurement } from './global';
import MeterId = require('./meter_id');

declare class DistributionSummary {
  constructor(id: MeterId);
  record(amount: number): void;
  measure(): [] | [Measurement, Measurement, Measurement, Measurement];
}

export = DistributionSummary;
