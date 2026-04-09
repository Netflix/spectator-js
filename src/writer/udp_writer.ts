import {Writer} from "./writer.js";
import {get_logger, Logger} from "../logger/logger.js";
import {createSocket, Socket} from "node:dgram";
import {isIPv6} from "node:net";

const RESOLVED = Promise.resolve();
const DEFAULT_MAX_BUFFER_BYTES = 8192;
const DEFAULT_FLUSH_INTERVAL_MS = 15000;

/**
 * Buffers metrics and flushes them as newline-delimited UDP packets,
 * either when the buffer reaches the configured max size or after the flush interval.
 *
 * All socket operations (connect, send, close) are serialized through a single
 * Promise chain (_lastOperation) to prevent races between flush and close.
 */
export class UdpWriter extends Writer {
    private _socket: Socket;
    private _lastOperation: Promise<void>;
    private _buffer: string[] = [];
    private _bufferBytes = 0;
    private _flushTimer: ReturnType<typeof setTimeout> | null = null;
    private _closed = false;
    private readonly _maxBufferBytes: number;
    private readonly _flushIntervalMs: number;

    constructor(location: string, address: string, port: number, logger: Logger = get_logger(),
                maxBufferBytes: number = DEFAULT_MAX_BUFFER_BYTES, flushIntervalMs: number = DEFAULT_FLUSH_INTERVAL_MS) {
        super(logger);
        this._maxBufferBytes = maxBufferBytes;
        this._flushIntervalMs = flushIntervalMs;
        this._logger.debug(`initialize UdpWriter to ${location}`);
        this._socket = createSocket(isIPv6(address) ? "udp6" : "udp4");
        this._lastOperation = new Promise((resolve) => {
            this._socket.connect(port, address, resolve);
        });
    }

    // Appends to the buffer synchronously. Triggers a flush when the buffer
    // exceeds the max size, or schedules one after the flush interval.
    write(line: string): Promise<void> {
        if (this._closed) return RESOLVED;
        this._buffer.push(line);
        this._bufferBytes += line.length + 1;

        if (this._bufferBytes >= this._maxBufferBytes) {
            this.flush();
        } else if (!this._flushTimer) {
            this._flushTimer = setTimeout(() => this.flush(), this._flushIntervalMs);
        }

        return RESOLVED;
    }

    // Clears the timer synchronously (must happen before chaining, so a pending
    // timer can't schedule a flush that runs after close), then chains drainBuffer.
    close(): Promise<void> {
        this._closed = true;
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }

        this._lastOperation = this._lastOperation.then(() => this.drainBuffer(true));
        return this._lastOperation;
    }

    // Chains a drainBuffer onto _lastOperation so it waits for any in-flight send.
    private flush(): void {
        this._lastOperation = this._lastOperation.then(() => this.drainBuffer(false));
    }

    // Sends all buffered lines as a single newline-delimited UDP packet.
    // When andClose is true, closes the socket after the send completes.
    private drainBuffer(andClose: boolean): Promise<void> | void {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }

        if (this._buffer.length === 0) {
            if (andClose) return new Promise<void>((resolve) => this._socket.close(resolve));
            return;
        }

        const payload = this._buffer.join("\n");
        this._buffer = [];
        this._bufferBytes = 0;

        return new Promise<void>((resolve) => {
            this._socket.send(payload, (err: Error | null) => {
                if (err) this._logger.error(`failed to send udp payload: ${err.message}`);
                if (andClose) {
                    this._socket.close(resolve);
                } else {
                    resolve();
                }
            });
        });
    }
}
