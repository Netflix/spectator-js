import {Id} from "./id.js";
import {WriterUnion} from "../writer/new_writer.js";

export abstract class Meter {
    protected _id: Id;
    protected _meter_type_symbol: string;
    protected readonly _writer: WriterUnion;

    protected constructor(id: Id, writer: WriterUnion, meter_type_symbol: string) {
        this._id = id;
        this._meter_type_symbol = meter_type_symbol;
        this._writer = writer;
    }

    public writer(): WriterUnion {
        return this._writer;
    }
}
