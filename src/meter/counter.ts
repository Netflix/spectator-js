import {Id} from "./id.js";
import {Meter} from "./meter.js"
import {new_writer, WriterUnion} from "../writer/new_writer.js";

export class Counter extends Meter {
    /**
     * The value is the number of increments that have occurred since the last time it was
     * recorded. The value will be reported to the Atlas backend as a rate-per-second.
     */

    constructor(id: Id, writer: WriterUnion = new_writer("none")) {
        super(id, writer, "c");
    }

    increment(delta: number = 1): Promise<void> {
        if (delta > 0) {
            const line = `${this._meter_type_symbol}:${this._id.spectatord_id}:${delta}`
            return this._writer.write(line);
        } else {
            return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
                resolve();
            });
        }
    }
}
