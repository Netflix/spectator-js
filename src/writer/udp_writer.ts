import {Writer} from "./writer.js";
import {get_logger, Logger} from "../logger/logger.js";
import {createSocket, Socket} from "node:dgram";
import {isIPv6} from "node:net";

const RESOLVED = Promise.resolve();
const MAX_BUFFER_BYTES = 8192;
const FLUSH_INTERVAL_MS = 15000;

/**
 * Buffers metrics and flushes them as newline-delimited UDP packets,
 * either when the buffer reaches MAX_BUFFER_BYTES or every FLUSH_INTERVAL_MS.
 */
export class UdpWriter extends Writer {
    private _socket: Socket;
    private _ready: Promise<void>;
    private _buffer: string[] = [];
    private _bufferBytes = 0;
    private _flushTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(location: string, address: string, port: number, logger: Logger = get_logger()) {
        super(logger);
        this._logger.debug(`initialize UdpWriter to ${location}`);
        this._socket = createSocket(isIPv6(address) ? "udp6" : "udp4");
        this._ready = new Promise((resolve) => {
            this._socket.connect(port, address, resolve);
        });
    }

    write(line: string): Promise<void> {
        this._buffer.push(line);
        this._bufferBytes += line.length + 1;

        if (this._bufferBytes >= MAX_BUFFER_BYTES) {
            this.flush();
        } else if (!this._flushTimer) {
            this._flushTimer = setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
        }

        return RESOLVED;
    }

    close(): Promise<void> {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }

        return this._ready.then(() => {
            if (this._buffer.length === 0) {
                return new Promise<void>((resolve) => this._socket.close(resolve));
            }

            const payload = this._buffer.join("\n");
            this._buffer = [];
            this._bufferBytes = 0;

            return new Promise<void>((resolve) => {
                this._socket.send(payload, (err: Error | null) => {
                    if (err) this._logger.error(`failed to send udp payload: ${err.message}`);
                    this._socket.close(resolve);
                });
            });
        });
    }

    private flush(): void {
        this._ready.then(() => {
            if (this._buffer.length === 0) return;

            if (this._flushTimer) {
                clearTimeout(this._flushTimer);
                this._flushTimer = null;
            }

            const payload = this._buffer.join("\n");
            this._buffer = [];
            this._bufferBytes = 0;

            this._socket.send(payload, (err: Error | null) => {
                if (err) this._logger.error(`failed to send udp payload: ${err.message}`);
            });
        });
    }
}
