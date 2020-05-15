import { Tags } from './global';
import MeterId = require('./meter_id');
import Registry = require('./registry');

declare class PolledMeterBuilder {
  constructor(registry: Registry);
  withId(id: MeterId): this;
  withName(name: string): this;
  withTags(tags: Tags): this;
  monitorValue(func: Function): void;
  monitorMonotonicNumber(func: Function): void;
}

declare class PolledMeter {
  static using(registry: Registry): PolledMeterBuilder;
}

export = PolledMeter;
