import {Writer} from "./writer.js";
import {get_logger, Logger} from "../logger/logger.js";
import {WriterUnion} from "./new_writer.js";

export function isMemoryWriter(writer: WriterUnion): writer is MemoryWriter {
    return (writer as MemoryWriter).is_empty !== undefined;
}

export class MemoryWriter extends Writer {
    /**
     * Writer that stores lines in a list, to support unit testing.
     */

    private _messages: string[];

    constructor(logger: Logger<string> = get_logger()) {
        super(logger);
        this._logger.debug("initialize MemoryWriter");
        this._messages = [];
    }

    write(line: string): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            this._logger.debug(`write line=${line}`);
            this._messages.push(line);
            resolve();
        });
    }

    close(): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            this._messages = [];
            resolve();
        });
    }

    get(): string[] {
        return this._messages;
    }

    clear(): void {
        this._messages = [];
    }

    is_empty(): boolean {
        return this._messages.length == 0;
    }

    last_line(): string {
        return this._messages[this._messages.length - 1];
    }
}
