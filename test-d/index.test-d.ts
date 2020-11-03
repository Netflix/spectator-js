import { expectDeprecated, expectError, expectType } from 'tsd';
import { Registry } from '../';
import Counter from '../types/counter';
import DistributionSummary from '../types/dist_summary';
import MeterId from '../types/meter_id';
import Gauge from '../types/gauge';
import Timer from '../types/timer';
import { Measurement } from '../types/global';

// Main Registry
expectType<Registry>(new Registry());
// Allow empty object also
const registry = new Registry({});
expectType<Registry>(registry);

// Counter
expectType<Counter>(registry.counter('id', { tag: 'tag' }));
expectDeprecated(registry.dcounter('id', { tag: 'tag' }));

// MeterId
expectType<MeterId>(registry.createId('id', { tag: 'tag' }));

// Distribution Summary
expectType<DistributionSummary>(
  registry.distributionSummary('id', { tag: 'tag' })
);
expectDeprecated(registry.distSummary('id', { tag: 'tag' }));

// Gauge
expectType<Gauge>(registry.gauge('id', { tag: 'tag' }));

// Timer
expectType<Timer>(registry.timer('id', { tag: 'tag' }));

// Start/Stop
expectType<void>(registry.start());
expectType<void>(registry.stop());

// Measurements
expectType<Measurement[]>(registry.measurements());

// Meters
expectType<(Counter | DistributionSummary | Gauge | Timer)[]>(
  registry.meters()
);
