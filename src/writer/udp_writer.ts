import {Writer} from "./writer.js";
import {get_logger, Logger} from "../logger/logger.js";
import {createSocket, Socket} from "node:dgram";
import {isIPv6} from "node:net";

const RESOLVED = Promise.resolve();
const DEFAULT_MAX_BUFFER_BYTES = 32768;
const DEFAULT_FLUSH_INTERVAL_MS = 15000;

/**
 * Buffers metrics and flushes them as newline-delimited UDP packets, either when
 * the buffer reaches the configured max size or after the flush interval. The
 * buffer is snapshot synchronously on flush, so each datagram carries at most the
 * configured buffer size unless a single metric line is larger than the buffer.
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
        this._socket.on('error', (err) => this._logger.error(`udp socket error: ${err.message}`));
        this._lastOperation = new Promise((resolve) => {
            let settled = false;
            const settle = (): void => {
                if (settled) return;
                settled = true;
                this._socket.off("error", onInitialError);
                resolve();
            };
            const onInitialError = (_err: Error): void => settle();

            this._socket.once("error", onInitialError);
            try {
                this._socket.connect(port, address, settle);
            } catch (err) {
                this._socket.off("error", onInitialError);
                throw err;
            }
        });
    }

    // Appends to the buffer synchronously. Flushes before appending a line that
    // would exceed the configured max size, or after the flush interval.
    write(line: string): Promise<void> {
        if (this._closed) return RESOLVED;
        // Spectator protocol lines are ASCII after Id sanitization, so string
        // length is the byte count without Buffer.byteLength's per-write scan.
        const bufferedLines = this._buffer.length;
        let nextBufferBytes = this._bufferBytes + (bufferedLines === 0 ? 0 : 1) + line.length;

        if (bufferedLines > 0 && nextBufferBytes > this._maxBufferBytes) {
            this.flush();
            nextBufferBytes = line.length;
        }

        this._buffer.push(line);
        this._bufferBytes = nextBufferBytes;

        if (this._bufferBytes >= this._maxBufferBytes) {
            this.flush();
        } else if (!this._flushTimer) {
            this._flushTimer = setTimeout(() => this.flush(), this._flushIntervalMs);
            this._flushTimer.unref();
        }

        return RESOLVED;
    }

    // Snapshots any remaining buffered lines synchronously (so a late write can't
    // be swept into the closing send), then sends them and closes the socket
    // after all previously-chained sends have drained.
    close(): Promise<void> {
        if (this._closed) return this._lastOperation;
        this._closed = true;
        this.clearTimer();

        const payload = this.takePayload();
        this._lastOperation = this._lastOperation.then(async () => {
            if (payload !== null) await this.sendPayload(payload);
            await new Promise<void>((resolve) => this._socket.close(() => resolve()));
        });
        return this._lastOperation;
    }

    // Snapshots the buffered lines into one payload and resets the buffer
    // SYNCHRONOUSLY, then chains the send. Capturing the payload here (rather
    // than when the chained send runs) bounds each datagram to one buffer's
    // worth: writes that arrive before the send executes accumulate into a fresh
    // buffer instead of growing the one already handed off to be sent.
    private flush(): void {
        this.clearTimer();
        const payload = this.takePayload();
        if (payload === null) return;
        this._lastOperation = this._lastOperation.then(() => this.sendPayload(payload));
    }

    private takePayload(): string | null {
        if (this._buffer.length === 0) return null;
        const payload = this._buffer.join("\n");
        this._buffer.length = 0;
        this._bufferBytes = 0;
        return payload;
    }

    private sendPayload(payload: string): Promise<void> {
        return new Promise<void>((resolve) => {
            const onSend = (err: Error | null): void => {
                if (err) this._logger.error(`failed to send udp payload: ${err.message}`);
                resolve();
            };

            try {
                this._socket.send(payload, onSend);
            } catch (err) {
                if (err instanceof Error) this._logger.error(`failed to send udp payload: ${err.message}`);
                resolve();
            }
        });
    }

    private clearTimer(): void {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }
    }
}
