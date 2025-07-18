import {Writer} from "./writer.js";
import {get_logger, Logger} from "../logger/logger.js";

export class NoopWriter extends Writer {
    /**
     * Writer that does nothing. Used to disable output.
     */

    constructor(logger: Logger<string> = get_logger()) {
        super(logger);
        this._logger.debug("initialize NoopWriter");
    }

    write(line: string): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            this._logger.debug(`write line=${line}`);
            resolve();
        });
    }

    close(): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            resolve();
        });
    }
}
