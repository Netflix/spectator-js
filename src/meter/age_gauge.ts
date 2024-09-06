import {Id} from "./id.js";
import {Meter} from "./meter.js"
import {new_writer, WriterUnion} from "../writer/new_writer.js";

export class AgeGauge extends Meter {
    /**
     * The value is the time in seconds since the epoch at which an event has successfully
     * occurred, or 0 to use the current time in epoch seconds. After an Age Gauge has been set,
     * it will continue reporting the number of seconds since the last time recorded, for as long
     * as the SpectatorD process runs. This meter type makes it easy to implement the Time Since
     * Last Success alerting pattern.
     */

    constructor(id: Id, writer: WriterUnion = new_writer("none")) {
        super(id, writer, "A");
    }

    now(): Promise<void> {
        const line = `${this._meter_type_symbol}:${this._id.spectatord_id}:0`
        return this._writer.write(line);
    }

    set(seconds: number): Promise<void> {
        const line = `${this._meter_type_symbol}:${this._id.spectatord_id}:${seconds}`
        return this._writer.write(line);
    }
}
