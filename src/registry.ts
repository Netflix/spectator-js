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

    constructor(config: Config = new Config()) {
        this._config = config;
        this.logger = config.logger;
        this._writer = new_writer(this._config.location, this.logger);
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
            return new Promise((_: (value: void | PromiseLike<void>) => void, reject: (reason?: any) => void): void => {
                reject(error);
            });
        }
    }

    new_id(name: string, tags: Tags = {}): Id {
        /**
         * Create a new MeterId, which applies any configured extra common tags,
         * and can be used as an input to the *_with_id Registry methods.
         */
        let new_meter_id: Id = new Id(name, tags);

        if (Object.keys(this._config.extra_common_tags).length > 0) {
            new_meter_id = new_meter_id.with_tags(this._config.extra_common_tags);
        }

        return new_meter_id;
    }

    age_gauge(name: string, tags: Tags = {}): AgeGauge {
        const id = this.new_id(name, tags);
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new AgeGauge(id, writer);
    }

    age_gauge_with_id(id: Id): AgeGauge {
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new AgeGauge(id, writer);
    }

    counter(name: string, tags: Tags = {}): Counter {
        const id = this.new_id(name, tags);
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new Counter(id, writer);
    }

    counter_with_id(id: Id): Counter {
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new Counter(id, writer);
    }

    distribution_summary(name: string, tags: Tags = {}): DistributionSummary {
        const id = this.new_id(name, tags);
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new DistributionSummary(id, writer);
    }

    distribution_summary_with_id(id: Id): DistributionSummary {
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new DistributionSummary(id, writer);
    }

    gauge(name: string, tags: Tags = {}, ttl_seconds?: number): Gauge {
        const id = this.new_id(name, tags);
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new Gauge(id, writer, ttl_seconds);
    }

    gauge_with_id(id: Id, ttl_seconds?: number): Gauge {
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new Gauge(id, writer, ttl_seconds);
    }

    max_gauge(name: string, tags: Tags = {}): MaxGauge {
        const id = this.new_id(name, tags);
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new MaxGauge(id, writer);
    }

    max_gauge_with_id(id: Id): MaxGauge {
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new MaxGauge(id, writer);
    }

    monotonic_counter(name: string, tags: Tags = {}): MonotonicCounter {
        const id = this.new_id(name, tags);
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new MonotonicCounter(id, writer);
    }

    monotonic_counter_with_id(id: Id): MonotonicCounter {
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new MonotonicCounter(id, writer);
    }

    monotonic_counter_uint(name: string, tags: Tags = {}): MonotonicCounterUint {
        const id = this.new_id(name, tags);
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new MonotonicCounterUint(id, writer);
    }

    monotonic_counter_uint_with_id(id: Id): MonotonicCounterUint {
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new MonotonicCounterUint(id, writer);
    }

    pct_distribution_summary(name: string, tags: Tags = {}): PercentileDistributionSummary {
        const id = this.new_id(name, tags);
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new PercentileDistributionSummary(id, writer);
    }

    pct_distribution_summary_with_id(id: Id): PercentileDistributionSummary {
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new PercentileDistributionSummary(id, writer);
    }

    pct_timer(name: string, tags: Tags = {}): PercentileTimer {
        const id = this.new_id(name, tags);
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new PercentileTimer(id, writer);
    }

    pct_timer_with_id(id: Id): PercentileTimer {
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new PercentileTimer(id, writer);
    }

    timer(name: string, tags: Tags = {}): Timer {
        const id = this.new_id(name, tags);
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new Timer(id, writer);
    }

    timer_with_id(id: Id): Timer {
        const writer = id.invalid ? new NoopWriter() : this._writer;
        return new Timer(id, writer);
    }
}
