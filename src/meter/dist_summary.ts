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
            const line = `${this._meter_type_symbol}:${this._id.spectatord_id}:${amount}`
            return this._writer.write(line);
        } else {
            return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
                resolve();
            });
        }
    }
}
