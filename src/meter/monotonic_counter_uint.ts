import {Id} from "./id.js";
import {Meter} from "./meter.js"
import {new_writer, WriterUnion} from "../writer/new_writer.js";

export class MonotonicCounterUint extends Meter {
    /**
     * The value is a monotonically increasing number of an uint64 data type. These kinds of
     * values are commonly seen in networking metrics, such as bytes-per-second. A minimum of two
     * samples must be received in order for SpectatorD to calculate a delta value and report it to
     * the backend.
     *
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt/asUintN
     */

    constructor(id: Id, writer: WriterUnion = new_writer("none")) {
        super(id, writer, "U");
    }

    set(amount: bigint): Promise<void> {
        const line = `${this._meter_type_symbol}:${this._id.spectatord_id}:${BigInt.asUintN(64, amount)}`
        return this._writer.write(line);
    }
}
