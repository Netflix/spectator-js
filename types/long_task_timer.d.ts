import Registry = require('./registry');
import MeterId = require('./meter_id');

declare class LongTaskTimer {
  static get(registry: Registry, id: MeterId): LongTaskTimer;
  constructor(registry: Registry);
  start(): number;
  stop(task: number): number;
  get activeTasks(): number;
  get duration(): number;
}

export = LongTaskTimer;
