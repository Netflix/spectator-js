import {Config} from "./config.js";
import {Logger} from "./logger/logger.js";
import {Id, Tags, tags_toString} from "./meter/id.js";

import {AgeGauge} from "./meter/age_gauge.js";
import {Counter} from "./meter/counter.js";
import {DistributionSummary} from "./meter/dist_summary.js";
import {Gauge} from "./meter/gauge.js";
import {MaxGauge} from "./meter/max_gauge.js";
import {MonotonicCounter} from "./meter/monotonic_counter.js";
import {MonotonicCounterUint} from "./meter/monotonic_counter_uint.js";
import {PercentileDistributionSummary} from "./meter/percentile_dist_summary.js";
import {PercentileTimer} from "./meter/percentile_timer.js";
import {Timer} from "./meter/timer.js";
import {new_writer, WriterUnion} from "./writer/new_writer.js";
import {NoopWriter} from "./writer/noop_writer.js";


export class Registry {
    /**
     * Registry is the main entry point for interacting with the Spectator library.
     */

    public logger: Logger;

    private _config: Config;
    private readonly _writer: WriterUnion;
    private readonly _noop_writer: NoopWriter;
    private readonly _has_extra_common_tags: boolean;

    constructor(config: Config = new Config()) {
        this._config = config;
        this.logger = config.logger;
        this._writer = new_writer(this._config.location, this.logger);
        this._noop_writer = new NoopWriter();
        this._has_extra_common_tags = Object.keys(this._config.extra_common_tags).length > 0;
        this.logger.debug(`Create Registry with extra_common_tags=${tags_toString(this._config.extra_common_tags)}`);
    }

    config(): Config {
        return this._config;
    }

    writer(): WriterUnion {
        return this._writer;
    }

    close(): Promise<void> {
        try {
            this.logger.debug("Close Registry Writer");
            return this._writer.close();
        } catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Error closing Registry Writer: ${error.message}`);
            }
            return Promise.reject(error);
        }
    }

    new_id(name: string, tags: Tags = {}): Id {
        /**
         * Create a new MeterId, which applies any configured extra common tags,
         * and can be used as an input to the *_with_id Registry methods.
         */
        if (!this._has_extra_common_tags) {
            return new Id(name, tags);
        }

        // Merge first so we only build one Id (one validate + sort + regex pass).
        // extra_common_tags are spread last to win on key collisions, matching the
        // previous semantics of with_tags(extra_common_tags) overlaying user tags.
        return new Id(name, {...tags, ...this._config.extra_common_tags});
    }

    private create<T>(MeterClass: new (id: Id, writer: WriterUnion) => T, id: Id): T {
        const writer = id.invalid ? this._noop_writer : this._writer;
        return new MeterClass(id, writer);
    }

    age_gauge(name: string, tags: Tags = {}): AgeGauge {
        return this.create(AgeGauge, this.new_id(name, tags));
    }

    age_gauge_with_id(id: Id): AgeGauge {
        return this.create(AgeGauge, id);
    }

    counter(name: string, tags: Tags = {}): Counter {
        return this.create(Counter, this.new_id(name, tags));
    }

    counter_with_id(id: Id): Counter {
        return this.create(Counter, id);
    }

    distribution_summary(name: string, tags: Tags = {}): DistributionSummary {
        return this.create(DistributionSummary, this.new_id(name, tags));
    }

    distribution_summary_with_id(id: Id): DistributionSummary {
        return this.create(DistributionSummary, id);
    }

    gauge(name: string, tags: Tags = {}, ttl_seconds?: number): Gauge {
        const id = this.new_id(name, tags);
        const writer = id.invalid ? this._noop_writer : this._writer;
        return new Gauge(id, writer, ttl_seconds);
    }

    gauge_with_id(id: Id, ttl_seconds?: number): Gauge {
        const writer = id.invalid ? this._noop_writer : this._writer;
        return new Gauge(id, writer, ttl_seconds);
    }

    max_gauge(name: string, tags: Tags = {}): MaxGauge {
        return this.create(MaxGauge, this.new_id(name, tags));
    }

    max_gauge_with_id(id: Id): MaxGauge {
        return this.create(MaxGauge, id);
    }

    monotonic_counter(name: string, tags: Tags = {}): MonotonicCounter {
        return this.create(MonotonicCounter, this.new_id(name, tags));
    }

    monotonic_counter_with_id(id: Id): MonotonicCounter {
        return this.create(MonotonicCounter, id);
    }

    monotonic_counter_uint(name: string, tags: Tags = {}): MonotonicCounterUint {
        return this.create(MonotonicCounterUint, this.new_id(name, tags));
    }

    monotonic_counter_uint_with_id(id: Id): MonotonicCounterUint {
        return this.create(MonotonicCounterUint, id);
    }

    pct_distribution_summary(name: string, tags: Tags = {}): PercentileDistributionSummary {
        return this.create(PercentileDistributionSummary, this.new_id(name, tags));
    }

    pct_distribution_summary_with_id(id: Id): PercentileDistributionSummary {
        return this.create(PercentileDistributionSummary, id);
    }

    pct_timer(name: string, tags: Tags = {}): PercentileTimer {
        return this.create(PercentileTimer, this.new_id(name, tags));
    }

    pct_timer_with_id(id: Id): PercentileTimer {
        return this.create(PercentileTimer, id);
    }

    timer(name: string, tags: Tags = {}): Timer {
        return this.create(Timer, this.new_id(name, tags));
    }

    timer_with_id(id: Id): Timer {
        return this.create(Timer, id);
    }
}
