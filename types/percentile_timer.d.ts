import { Tags } from './global';
import MeterId = require('./meter_id');
import Registry = require('./registry');

declare class PercentileTimerBuilder {
  constructor(registry: Registry);
  withId(id: MeterId): this;
  withName(name: string): this;
  withTags(tags: Tags): this;
  withRangeSeconds(min: number, max: number): this;
  withRangeMilliseconds(min: number, max: number): this;
  withRangeNanoseconds(min: number, max: number): this;
  build(): PercentileTimer;
}

declare class PercentileTimer {
  static get(registry: Registry, id: MeterId): PercentileTimer;
  static Builder(): PercentileTimerBuilder;
  constructor(registry: Registry, id: MeterId, min?: number, max?: number);
  percentile(p: number): number;
  record(seconds: [number, number] | number, nanos: number): void;
  get count(): number;
  get totalTime(): number;
}

export = PercentileTimer;
