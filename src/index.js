'use strict';

const AtlasRegistry = require('./registry');
const PolledMeter = require('./polled_meter');
const PercentileTimer = require('./percentile_timer');
const PercentileDistributionSummary = require('./percentile_dist_summary');
const BucketFunctions = require('./bucket_functions');
const BucketCounter = require('./bucket_counter');
const BucketDistributionSummary = require('./bucket_dist_summary');
const BucketTimer = require('./bucket_timer');
const IntervalCounter = require('./interval_counter');
const LongTaskTimer = require('./long_task_timer');

module.exports = {
  Registry: AtlasRegistry,
  PolledMeter: PolledMeter,
  PercentileTimer: PercentileTimer,
  PercentileDistributionSummary: PercentileDistributionSummary,
  BucketFunctions: BucketFunctions,
  BucketCounter: BucketCounter,
  BucketDistributionSummary: BucketDistributionSummary,
  BucketTimer: BucketTimer,
  IntervalCounter: IntervalCounter,
  LongTaskTimer: LongTaskTimer
};
