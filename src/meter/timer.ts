import {Id} from "./id.js";
import {Meter} from "./meter.js"
import {new_writer, WriterUnion} from "../writer/new_writer.js";

export class Timer extends Meter {
    /**
     * The value is the number of seconds that have elapsed for an event.
     */

    constructor(id: Id, writer: WriterUnion = new_writer("none")) {
        super(id, writer, "t");
    }

    /**
     * @param {number|number[]|bigint} seconds
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
     */
    record(seconds: number | number[] | bigint): Promise<void> {
        let elapsed: number;

        if (typeof seconds === 'bigint') {
            elapsed = Number(seconds) / 1e9;
        } else if (seconds instanceof Array) {
            elapsed = seconds[0] + (seconds[1] / 1e9);
        } else {
            elapsed = seconds;
        }

        if (elapsed >= 0) {
            const line = `${this._meter_type_symbol}:${this._id.spectatord_id}:${elapsed}`;
            return this._writer.write(line);
        } else {
            return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
                resolve();
            });
        }
    }
}
