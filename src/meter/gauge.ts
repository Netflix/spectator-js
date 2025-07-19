import {Id} from "./id.js";
import {Meter} from "./meter.js"
import {new_writer, WriterUnion} from "../writer/new_writer.js";

export class Gauge extends Meter {
    /**
     * The value is a number that was sampled at a point in time. The default time-to-live (TTL)
     * for gauges is 900 seconds (15 minutes) - they will continue reporting the last value set for
     * this duration of time. An optional ttl_seconds may be set to control the lifespan of these
     * values. SpectatorD enforces a minimum TTL of 5 seconds.
     */

    constructor(id: Id, writer: WriterUnion = new_writer("none"), ttl_seconds?: number) {
        let meter_type_symbol: string;
        if (ttl_seconds == undefined) {
            meter_type_symbol = "g"
        } else {
            meter_type_symbol = `g,${ttl_seconds}`;
        }
        super(id, writer, meter_type_symbol);
    }

    set(value: number): Promise<void> {
        const line = `${this._meter_type_symbol}:${this._id.spectatord_id}:${value}`
        return this._writer.write(line);
    }

    update(value: number): Promise<void> {
        return this.set(value);
    }
}
