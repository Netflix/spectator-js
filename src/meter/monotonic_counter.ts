import {Id} from "./id.js";
import {Meter} from "./meter.js"
import {new_writer, WriterUnion} from "../writer/new_writer.js";

export class MonotonicCounter extends Meter {
    /**
     * The value is a monotonically increasing number. A minimum of two samples must be received
     * in order for SpectatorD to calculate a delta value and report it to the backend.
     */

    constructor(id: Id, writer: WriterUnion = new_writer("none")) {
        super(id, writer, "C");
    }

    set(amount: number): Promise<void> {
        const line = `${this._meter_type_symbol}:${this._id.spectatord_id}:${amount}`
        return this._writer.write(line);
    }
}
