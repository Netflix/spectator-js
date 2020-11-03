import Counter = require('./counter');
import DistributionSummary = require('./dist_summary');
import Gauge = require('./gauge');
import { Tags, Measurement } from './global';
import MeterId = require('./meter_id');
import Timer = require('./timer');

interface ConfigOptions {
  uri: string;
  commonTags: Tags;
  strictMode: boolean;
  gaugePollingFrequency: number;
  frequency: number;
  logger: any;
  publisher: any;
}

interface Logger {
  debug: (value: string) => void;
  info: (value: string) => void;
  error: (value: string) => void;
}

declare class Registry {
  constructor(config?: Partial<ConfigOptions>);
  logger: Logger;
  createId(name: string, tags: Tags): MeterId;
  counter(nameOrId: string | MeterId, tags: Tags): Counter;
  /**
   * @deprecated
   **/
  dcounter(nameOrId: string | MeterId, tags: Tags): Counter;
  distributionSummary(nameOrId: string, tags: Tags): DistributionSummary;
  /**
   * @deprecated
   **/
  distSummary(nameOrId: string | MeterId, tags: Tags): DistributionSummary;
  gauge(nameOrId: string | MeterId, tags: Tags): Gauge;
  timer(nameOrId: string | MeterId, tags: Tags): Timer;
  start(): void;
  stop(cb?: (e: Error, res: any) => void): void;
  measurements(): Measurement[];
  meters(): (Counter | DistributionSummary | Gauge | Timer)[];
  hrtime(time: [number, number]): [number, number];
}

export = Registry;
