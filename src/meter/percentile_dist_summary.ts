import {Id} from "./id.js";
import {Meter} from "./meter.js"
import {new_writer, WriterUnion} from "../writer/new_writer.js";

export class PercentileDistributionSummary extends Meter {
    /**
     * The value tracks the distribution of events. It is similar to a Timer, but more general,
     * because the size does not have to be a period of time. For example, it can be used to
     * measure the payload sizes of requests hitting a server or the number of records returned
     * from a query.
     *
     * In order to maintain the data distribution, Percentile Distribution Summaries have a higher
     * storage cost, with a worst-case of up to 300X that of a standard Distribution Summary. Be
     * diligent about any additional dimensions added to Percentile Distribution Summaries and ensure
     * that they have a small bounded cardinality.
     */

    constructor(id: Id, writer: WriterUnion = new_writer("none")) {
        super(id, writer, "D");
    }

    record(amount: number): Promise<void> {
        if (amount >= 0) {
            return this._writer.write(this._line_prefix + amount);
        }
        return Promise.resolve();
    }
}
