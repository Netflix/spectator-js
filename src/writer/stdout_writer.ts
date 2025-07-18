import {Writer} from "./writer.js";
import {get_logger, Logger} from "../logger/logger.js";

export class StdoutWriter extends Writer {
    /**
     * Writer that outputs data to stdout.
     */

    constructor(logger: Logger<string> = get_logger()) {
        super(logger);
        this._logger.debug("initialize StdoutWriter");
    }

    write(line: string): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            this._logger.debug(`write line=${line}`);
            process.stdout.write(line);
            resolve();
        });
    }

    close(): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            resolve();
        });
    }
}
