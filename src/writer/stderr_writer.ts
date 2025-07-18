import {Writer} from "./writer.js";
import {get_logger, Logger} from "../logger/logger.js";

export class StderrWriter extends Writer {
    /**
     * Writer that outputs data to stderr.
     */

    constructor(logger: Logger<string> = get_logger()) {
        super(logger);
        this._logger.debug("initialize StderrWriter");
    }

    write(line: string): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            this._logger.debug(`write line=${line}`);
            process.stderr.write(line);
            resolve();
        });
    }

    close(): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            resolve();
        });
    }
}
