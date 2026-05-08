import {Id} from "./id.js";
import {Meter} from "./meter.js"
import {new_writer, WriterUnion} from "../writer/new_writer.js";
import {Stopwatch} from "./stopwatch.js";

export class Timer extends Meter {
    /**
     * The value is the number of seconds that have elapsed for an event.
     */

    constructor(id: Id, writer: WriterUnion = new_writer("none")) {
        super(id, writer, "t");
    }

    /**
     * Start a stopwatch that records elapsed time when stopped.
     */
    start(): Stopwatch {
        return new Stopwatch(this);
    }

    /**
     * Run a callback and record its elapsed time, including when the callback throws or rejects.
     */
    async time<T>(fn: () => T | Promise<T>): Promise<T> {
        const stopwatch = this.start();
        try {
            return await fn();
        } finally {
            await stopwatch.stop();
        }
    }

    /**
     * @param {number|number[]|bigint} seconds
     *
     *     Number of seconds, which may be:
     *
     *     - Integer or fractional seconds.
     *     - An array of two numbers [seconds, nanoseconds], which is the return value from
     *     process.hrtime(), and serves as a convenient means of recording latency durations.
     *     - A bigint, which should be in nanoseconds.
     *
     *     start = process.hrtime();
     *     // do work
     *     registry.timer("eventLatency").record(process.hrtime(start));
     *
     * @param {number} nanos Optional nanoseconds, as if recording values extracted from process.hrtime(). This
     * variation should be paired with the first parameter representing seconds.
     */
    record(seconds: number | number[] | bigint, nanos?: number): Promise<void> {
        let elapsed: number;

        if (typeof seconds === 'bigint') {
            elapsed = Number(seconds) / 1e9;
        } else if (Array.isArray(seconds)) {
            elapsed = seconds[0] + (seconds[1] / 1e9);
        } else {
            nanos = nanos || 0;
            elapsed = seconds + (nanos / 1e9);
        }

        if (elapsed >= 0) {
            return this._writer.write(this._line_prefix + elapsed);
        }
        return Promise.resolve();
    }
}
