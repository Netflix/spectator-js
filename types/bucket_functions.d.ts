declare type BucketFunction = (amount: number) => string;

export interface BucketFunctions {
  MAX_VALUE: number;
  age(max: number, unit: string): BucketFunction;
  ageBiasOld(max: number, unit: string): BucketFunction;
  bytes(max: number): BucketFunction;
  bytes(max: number, unit: string): BucketFunction;
  decimal(max: number): BucketFunction;
  latency(max: number, unit: string): BucketFunction;
  latencyBiasSlow(max: number, unit: string): BucketFunction;
}
