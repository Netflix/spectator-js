import MeterId = require('./meter_id');

declare interface Measurement {
  id: MeterId;
  v: number;
}

declare type Tags =
  | Record<string, string | number>
  | Map<string, string | number>;
