import {Logger} from "../logger/logger.js";

export abstract class Writer {
    protected _logger: Logger;

    protected constructor(logger: Logger) {
        this._logger = logger;
    }

    abstract write(line: string): Promise<void>;
    abstract close(): Promise<void>;
}
