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

    record(seconds: number = 1): Promise<void> {
        if (seconds >= 0) {
            const line = `${this._meter_type_symbol}:${this._id.spectatord_id}:${seconds}`
            return this._writer.write(line);
        } else {
            return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
                resolve();
            });
        }
    }
}
