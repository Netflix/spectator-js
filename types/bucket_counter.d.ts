import { BucketFunction } from './bucket_functions';
import MeterId = require('./meter_id');
import Registry = require('./registry');

declare class BucketCounter {
  static get(
    registry: Registry,
    id: MeterId,
    bucketFunction: BucketFunction
  ): BucketCounter;
  constructor(registry: Registry, id: MeterId, bucketFunction: BucketFunction);
  record(seconds: number): void;
}

export = BucketCounter;
