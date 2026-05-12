import {Writer} from "./writer.js";
import {get_logger, Logger} from "../logger/logger.js";
import {DgramSocket} from "node-unix-socket";
import {statSync, unlinkSync} from "node:fs";

const RESOLVED = Promise.resolve();
const DEFAULT_MAX_BUFFER_BYTES = 32768;
const DEFAULT_FLUSH_INTERVAL_MS = 15000;

/**
 * Buffers metrics and flushes them as newline-delimited datagrams over a
 * SOCK_DGRAM Unix domain socket. spectatord exposes such a socket at
 * /run/spectatord/spectatord.unix; using it instead of UDP raises the
 * documented throughput ceiling from ~430K req/sec to ~1M req/sec.
 *
 * Backed by node-unix-socket because Node's built-in `dgram` module is
 * UDP-only — it has no UDS-datagram support, and node core won't add it
 * (see https://github.com/nodejs/node/issues/29339, closed wontfix).
 *
 * All sends are serialized through _lastOperation to prevent races between
 * flush and close, mirroring UdpWriter.
 */
export class UdsWriter extends Writer {
    private readonly _socket: DgramSocket;
    private readonly _destPath: string;
    private readonly _clientPath: string;
    private _lastOperation: Promise<void>;
    private _buffer: string[] = [];
    private _bufferBytes = 0;
    private _flushTimer: ReturnType<typeof setTimeout> | null = null;
    private _closed = false;
    private readonly _maxBufferBytes: number;
    private readonly _flushIntervalMs: number;

    constructor(location: string, destPath: string, logger: Logger = get_logger(),
                maxBufferBytes: number = DEFAULT_MAX_BUFFER_BYTES, flushIntervalMs: number = DEFAULT_FLUSH_INTERVAL_MS) {
        super(logger);
        this._maxBufferBytes = maxBufferBytes;
        this._flushIntervalMs = flushIntervalMs;
        this._destPath = destPath;
        // Validate the spectatord-side socket up front so consumers get a
        // clear error at Registry construction time, rather than a cryptic
        // bind() failure on the client side or silent send drops at runtime.
        let stat;
        try {
            stat = statSync(destPath);
        } catch (err) {
            const code = (err as NodeJS.ErrnoException).code;
            if (code === "ENOENT") {
                throw new Error(`UDS destination does not exist: ${destPath}`);
            }
            throw err;
        }
        if (!stat.isSocket()) {
            throw new Error(`UDS destination is not a socket: ${destPath}`);
        }

        // SOCK_DGRAM unix sockets need a return-address bind on the client
        // side. Use pid + a short random suffix so multiple Registries in
        // the same process don't collide.
        const suffix = Math.random().toString(36).slice(2, 8);
        this._clientPath = `${destPath}.${process.pid}.${suffix}`;
        this._logger.debug(`initialize UdsWriter to ${location}`);

        this._socket = new DgramSocket();
        this._socket.on("error", (err: Error) => this._logger.error(`uds socket error: ${err.message}`));
        this._socket.bind(this._clientPath);

        // Defer the initial _lastOperation until the next event loop iteration
        // (after all synchronous writes + microtasks). UdpWriter gets this for
        // free because its initial promise waits on socket.connect; DgramSocket
        // has no async setup, so we synthesize the same delay. Without this,
        // chained drains run as microtasks between awaited writes and a
        // size-triggered flush could split lines across packets that callers
        // expect to land together.
        this._lastOperation = new Promise<void>((resolve) => {
            setImmediate(resolve);
        });
    }

    write(line: string): Promise<void> {
        if (this._closed) return RESOLVED;
        this._buffer.push(line);
        this._bufferBytes += line.length + 1;

        if (this._bufferBytes >= this._maxBufferBytes) {
            this.flush();
        } else if (!this._flushTimer) {
            this._flushTimer = setTimeout(() => this.flush(), this._flushIntervalMs);
            this._flushTimer.unref();
        }

        return RESOLVED;
    }

    close(): Promise<void> {
        if (this._closed) return this._lastOperation;
        this._closed = true;
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }

        this._lastOperation = this._lastOperation.then(() => this.drainBuffer(true));
        return this._lastOperation;
    }

    private flush(): void {
        this._lastOperation = this._lastOperation.then(() => this.drainBuffer(false));
    }

    private drainBuffer(andClose: boolean): Promise<void> | void {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }

        if (this._buffer.length === 0) {
            if (andClose) this.cleanup();
            return;
        }

        // node-unix-socket's sendTo only accepts Buffer (no string overload),
        // so we encode once per flush rather than per write.
        const payload = Buffer.from(this._buffer.join("\n"));
        this._buffer.length = 0;
        this._bufferBytes = 0;

        return new Promise<void>((resolve) => {
            this._socket.sendTo(payload, 0, payload.length, this._destPath, (err) => {
                if (err) this._logger.error(`failed to send uds payload: ${err.message}`);
                if (andClose) this.cleanup();
                resolve();
            });
        });
    }

    private cleanup(): void {
        try {
            this._socket.close();
        } catch (err) {
            if (err instanceof Error) this._logger.error(`uds close failed: ${err.message}`);
        }
        // Best-effort unlink of the client-side bound path so we don't leak
        // socket files on the filesystem.
        try {
            unlinkSync(this._clientPath);
        } catch {
            // Path already gone or never existed; ignore.
        }
    }
}
