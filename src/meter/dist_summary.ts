import {Id} from "./id.js";
import {Meter} from "./meter.js"
import {new_writer, WriterUnion} from "../writer/new_writer.js";

export class DistributionSummary extends Meter {
    /**
     * The value tracks the distribution of events. It is similar to a Timer, but more general,
     * because the size does not have to be a period of time. For example, it can be used to
     * measure the payload sizes of requests hitting a server or the number of records returned
     * from a query.
     */

    constructor(id: Id, writer: WriterUnion = new_writer("none")) {
        super(id, writer, "d");
    }

    record(amount: number): Promise<void> {
        if (amount >= 0) {
            return this._writer.write(this._line_prefix + amount);
        }
        return Promise.resolve();
    }
}
