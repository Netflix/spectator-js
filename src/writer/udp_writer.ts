import {Writer} from "./writer.js";
import {get_logger, Logger} from "../logger/logger.js";
import {createSocket, Socket} from "node:dgram";
import {isIPv6} from "node:net";
import process from "node:process";

const RESOLVED = Promise.resolve();
// Linux (and anything that isn't macOS) accepts datagrams well past 32KB, which
// is the size spectatord is tuned for.
const DEFAULT_MAX_BUFFER_BYTES = 32768;
// macOS caps a single UDP datagram at net.inet.udp.maxdgram, which defaults to
// 9216 bytes and doubles as the default SO_SNDBUF for UDP sockets; a larger send
// fails with EMSGSIZE rather than being fragmented. 9216 is therefore the largest
// datagram macOS will accept out of the box, so it becomes the default buffer size
// there.
const DARWIN_MAX_BUFFER_BYTES = 9216;
const DEFAULT_FLUSH_INTERVAL_MS = 15000;

/**
 * Largest datagram the host platform accepts by default. Used as the max buffer
 * size when the caller does not configure one.
 */
function default_max_buffer_bytes(): number {
    return process.platform === "darwin" ? DARWIN_MAX_BUFFER_BYTES : DEFAULT_MAX_BUFFER_BYTES;
}

/**
 * Buffers metrics and flushes them as newline-delimited UDP packets, either when
 * the buffer reaches the configured max size or after the flush interval. The
 * buffer is snapshot synchronously on flush, so each datagram carries at most the
 * configured buffer size unless a single metric line is larger than the buffer.
 *
 * A caller-provided maxBufferBytes is always honored as-is. When one is not
 * provided the default is platform-derived: 32768 bytes on Linux, and the smaller
 * 9216-byte macOS datagram cap on macOS (see DARWIN_MAX_BUFFER_BYTES), so the
 * out-of-the-box configuration does not produce EMSGSIZE sends on a developer's
 * Mac.
 *
 * All socket operations (connect, send, close) are serialized through a single
 * Promise chain (_lastOperation) to prevent races between flush and close.
 *
 * The socket is unreferenced so that an open writer cannot keep the Node event
 * loop alive — a referenced dgram socket stops a short-lived process from exiting
 * at all. Delivery is unaffected: libuv counts in-flight requests toward loop
 * liveness regardless of the handle's reference state.
 */
export class UdpWriter extends Writer {
    private _socket: Socket;
    private _lastOperation: Promise<void>;
    private _buffer: string[] = [];
    private _bufferBytes = 0;
    private _flushTimer: ReturnType<typeof setTimeout> | null = null;
    private _closed = false;
    private readonly _exitFlush: () => void;
    private readonly _maxBufferBytes: number;
    private readonly _flushIntervalMs: number;

    constructor(location: string, address: string, port: number, logger: Logger = get_logger(),
                maxBufferBytes: number = default_max_buffer_bytes(), flushIntervalMs: number = DEFAULT_FLUSH_INTERVAL_MS) {
        super(logger);
        this._maxBufferBytes = maxBufferBytes;
        this._flushIntervalMs = flushIntervalMs;
        this._logger.debug(`initialize UdpWriter to ${location} with maxBufferBytes=${this._maxBufferBytes} ` +
            `on platform=${process.platform}`);
        this._socket = createSocket(isIPv6(address) ? "udp6" : "udp4");
        // Unreference up front: connect() implicitly binds, and a handle that goes
        // active while unreferenced is never added to the loop's active set.
        this._socket.unref();
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

        // A buffer waiting on the (also unreferenced) flush timer has nothing to
        // hold the loop open, so a short-lived process would drop it. flush() and
        // not close(), because "beforeExit" can fire while the app still has work
        // and closing would discard every later write. Still no substitute for
        // close(): "beforeExit" does not run on process.exit() or a signal.
        this._exitFlush = (): void => this.flush();
        process.on("beforeExit", this._exitFlush);
    }

    // Appends to the buffer synchronously. Flushes before appending a line that
    // would exceed the configured max size, or after the flush interval.
    write(line: string): Promise<void> {
        if (this._closed) return RESOLVED;
        // Spectator protocol lines are ASCII after Id sanitization, so string
        // length is the byte count without Buffer.byteLength's per-write scan.
        // Count one newline terminator per metric. takePayload() currently emits
        // newline separators without a trailing newline, so _bufferBytes is a
        // conservative upper bound by one byte per datagram.
        const bufferedLines = this._buffer.length;
        const lineBytes = line.length + 1;
        let nextBufferBytes = this._bufferBytes + lineBytes;

        if (bufferedLines > 0 && nextBufferBytes > this._maxBufferBytes) {
            this.flush();
            nextBufferBytes = lineBytes;
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
        process.off("beforeExit", this._exitFlush);

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
