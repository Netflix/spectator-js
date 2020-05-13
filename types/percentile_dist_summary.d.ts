import { Tags } from './global';
import MeterId = require('./meter_id');
import Registry = require('./registry');

declare class PercentileDistSummaryBuilder {
  constructor(registry: Registry);
  withId(id: MeterId): this;
  withName(name: string): this;
  withTags(tags: Tags): this;
  withRange(min: number, max: number): this;
  build(): PercentileDistributionSummary;
}

declare class PercentileDistributionSummary {
  static get(registry: Registry, id: MeterId): PercentileDistributionSummary;
  static Builder(): PercentileDistSummaryBuilder;
  constructor(registry: Registry, id: MeterId, min?: number, max?: number);
  percentile(p: number): number;
  record(seconds: [number, number] | number, nanos: number): void;
  get count(): number;
  get totalTime(): number;
}

export = PercentileDistributionSummary;
