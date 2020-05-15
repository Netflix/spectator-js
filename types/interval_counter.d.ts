import MeterId = require('./meter_id');
import Registry = require('./registry');

declare class IntervalCounter {
  static get(registry: Registry, id: MeterId): IntervalCounter;
  constructor(registry: Registry, id: MeterId);
  add(delta: number): void;
  increment(delta: number): void;
  get count(): number;
  get secondsSinceLastUpdate(): number;
}

export = IntervalCounter;
