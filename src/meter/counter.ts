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

    add(amount: number = 1): Promise<void> {
        return this.increment(amount);
    }

    increment(amount: number = 1): Promise<void> {
        if (amount > 0) {
            return this._writer.write(this._line_prefix + amount);
        }
        return Promise.resolve();
    }
}
