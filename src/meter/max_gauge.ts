import {Id} from "./id.js";
import {Meter} from "./meter.js"
import {new_writer, WriterUnion} from "../writer/new_writer.js";

export class MaxGauge extends Meter {
    /**
     * The value is a number that was sampled at a point in time, but it is reported as a maximum
     * gauge value to the backend.
     */

    constructor(id: Id, writer: WriterUnion = new_writer("none")) {
        super(id, writer, "m");
    }

    set(value: number): Promise<void> {
        return this._writer.write(this._line_prefix + value);
    }

    update(value: number): Promise<void> {
        return this.set(value);
    }
}
