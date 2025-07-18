import {Writer} from "./writer.js";
import {get_logger, Logger} from "../logger/logger.js";
import fs from "node:fs/promises";
import {fileURLToPath} from "node:url";

export class FileWriter extends Writer {
    /**
     * Writer that outputs data to a file descriptor, which can be stdout, stderr, or a regular file.
     */

    private readonly _location: string;

    constructor(location: string, logger: Logger = get_logger()) {
        super(logger);
        // convert from URL string to PathLike string
        this._location = fileURLToPath(location);
        this._logger.debug(`initialize FileWriter to ${location}`);
    }

    write(line: string): Promise<void> {
        try {
            this._logger.debug(`write line=${line}`);
            return fs.appendFile(this._location, line + "\n");
        } catch (error) {
            return new Promise((_: (value: void | PromiseLike<void>) => void, reject: (reason?: any) => void): void => {
                if (error instanceof Error) {
                    this._logger.error(`failed to write line=${line}: ${error.message}`);
                }
                reject(error);
            });
        }
    }

    close(): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            resolve();
        });
    }
}
