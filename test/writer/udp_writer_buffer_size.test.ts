import {assert} from "chai";
import {AddressInfo} from "node:net";
import {createSocket, Socket} from "node:dgram";
import {after, before, describe, it} from "node:test";
// Import UdpWriter directly (not via ../../src/index.js) so this test does not
// transitively load UdsWriter / node-unix-socket.
import {UdpWriter} from "../../src/writer/udp_writer.js";
import type {Logger} from "../../src/logger/logger.js";

describe("UdpWriter buffer size", (): void => {

    let server: Socket;
    let address: string;
    let port: number;
    // byte length of every datagram the server receives
    const datagramSizes: number[] = [];
    // raw contents of every datagram, for reconstructing the delivered lines
    const messages: string[] = [];

    function sleep(ms: number): Promise<void> {
        return new Promise((resolve: () => void): void => {
            setTimeout(resolve, ms);
        });
    }

    // logger that swallows everything except surfacing send errors to the console
    const logger: Logger = {
        trace: (): void => {}, debug: (): void => {}, info: (): void => {},
        warn: (): void => {}, fatal: (): void => {},
        error: (message: string): void => console.error("  [udp writer]", message),
    };

    before((): Promise<void> => {
        return new Promise((resolve: () => void): void => {
            server = createSocket("udp4");
            server.on("error", (): void => {});
            server.on("message", (msg: Buffer): void => {
                datagramSizes.push(msg.length);
                messages.push(msg.toString());
            });
            server.bind(0, "127.0.0.1", (): void => {
                const info: AddressInfo = server.address();
                address = info.address;
                port = info.port;
                resolve();
            });
        });
    });

    after((): Promise<void> => {
        return new Promise((resolve: () => void): void => {
            server.close();
            resolve();
        });
    });

    // Reproduces "send EMSGSIZE": a single flush must never produce a datagram
    // larger than the configured buffer. A synchronous burst of writes should be
    // split into multiple bounded datagrams, NOT coalesced into one oversized packet.
    it("never sends a datagram larger than the configured buffer", async (): Promise<void> => {
        datagramSizes.length = 0;
        messages.length = 0;

        const MAX_BUFFER_BYTES = 256;
        const LINE = "x".repeat(63);                 // 4 lines plus counted newlines = 256 bytes
        const N = 100;                               // ~6400 bytes total — under the 9216
                                                     // macOS datagram cap, so even the buggy
                                                     // single packet is delivered and observable

        // long flush interval so ONLY the size threshold can trigger a flush
        const writer = new UdpWriter(`udp://${address}:${port}`, address, port, logger, MAX_BUFFER_BYTES, 60_000);

        try {
            // synchronous burst: no await between writes, mirroring a metrics hot path
            for (let i = 0; i < N; i++) {
                writer.write(LINE);
            }

            await writer.close();
            await sleep(100);   // let the loopback datagrams arrive

            assert.isAbove(datagramSizes.length, 0, "no datagrams were received");

            // The invariant the bug violates: one flush carries at most a full buffer.
            const largest = Math.max(...datagramSizes);
            assert.isAtMost(
                largest, MAX_BUFFER_BYTES,
                `largest datagram was ${largest} bytes but the configured buffer is ` +
                `${MAX_BUFFER_BYTES} bytes; the buffer was not flushed in bounded chunks`,
            );

            // and nothing should be dropped: reconstruct the delivered lines
            // across however many datagrams the writer chose to send.
            const lines = messages.flatMap((m) => m.split("\n"));
            assert.equal(lines.length, N, "some buffered lines were lost");
            assert.isTrue(lines.every((l) => l === LINE), "a delivered line was corrupted");
        } finally {
            await writer.close();
        }
    });

    it("sends a single line larger than the configured buffer", async (): Promise<void> => {
        datagramSizes.length = 0;
        messages.length = 0;

        const MAX_BUFFER_BYTES = 8;
        const LINE = "x".repeat(20);
        const writer = new UdpWriter(`udp://${address}:${port}`, address, port, logger, MAX_BUFFER_BYTES, 60_000);

        try {
            writer.write(LINE);

            await writer.close();
            await sleep(100);

            assert.deepEqual(messages, [LINE]);
            assert.deepEqual(datagramSizes, [LINE.length]);
        } finally {
            await writer.close();
        }
    });
});
