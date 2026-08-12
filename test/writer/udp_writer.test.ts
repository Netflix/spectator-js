import {assert} from "chai";
import {Config, new_writer, Registry, UdpWriter} from "../../src/index.js";
import {AddressInfo, isIPv4, isIPv6} from "node:net";
import {createSocket, Socket} from "node:dgram";
import dns from "node:dns";
import {spawn} from "node:child_process";
import {after, before, describe, it} from "node:test";
import type {Logger} from "../../src/logger/logger.js";

describe("UdpWriter Tests", (): void => {

    let server: Socket;
    let location: string;
    const messages: string[] = [];

    function sleep(ms: number): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            setTimeout(resolve, ms);
        });
    }

    before((): Promise<void> => {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            server = createSocket("udp4");
            server.on("error", (err: Error): void => {
                console.error('Server error:', err);
                server.close();
            });
            server.on("message", (msg: Buffer): void => {
                messages.push(msg.toString());
            });
            server.bind(0, "127.0.0.1", (): void => {
                const address: AddressInfo = server.address();
                location = `udp://${address.address}:${address.port}`;
                resolve();
            });
        });
    });

    after((): Promise<void> => {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            server.close();
            resolve();
        });
    });

    it("send metrics", async (): Promise<void> => {
        const writer = new_writer(location) as UdpWriter;

        await writer.write("c:server.numRequests,id=failed:1");
        await writer.write("c:server.numRequests,id=failed:2");
        await writer.close();

        await sleep(2);  // tiny pause is necessary to see data

        // messages are batched into newline-delimited UDP packets
        const lines = messages.flatMap((m) => m.split("\n"));
        assert.equal(lines.length, 2);
        assert.equal(lines[0], "c:server.numRequests,id=failed:1");
        assert.equal(lines[1], "c:server.numRequests,id=failed:2");

        messages.length = 0;  // clear server messages
    });

    it("using registry", async (): Promise<void> => {
        const r = new Registry(new Config(location));

        await r.counter("server.numRequests", {"id": "success"}).increment()
        await r.counter("server.numRequests", {"id": "success"}).increment(2)
        await r.close()

        await sleep(2);  // tiny pause is necessary to see data

        // messages are batched into newline-delimited UDP packets
        const lines = messages.flatMap((m) => m.split("\n"));
        assert.equal(lines.length, 2);
        assert.equal(lines[0], "c:server.numRequests,id=success:1");
        assert.equal(lines[1], "c:server.numRequests,id=success:2");

        messages.length = 0;  // clear server messages
    });

    it("flush on timeout", async (): Promise<void> => {
        const address = server.address();
        const writer = new UdpWriter(location, address.address, address.port, undefined, 8192, 50);

        try {
            await writer.write("c:server.numRequests,id=failed:1");
            await writer.write("c:server.numRequests,id=failed:2");
            await writer.write("c:server.numRequests,id=failed:3");

            // buffer is not full, so nothing sent yet
            assert.equal(messages.length, 0);

            // wait for the 50ms flush interval to fire
            await sleep(100);

            const lines = messages.flatMap((m) => m.split("\n"));
            assert.equal(lines.length, 3);
            assert.equal(lines[0], "c:server.numRequests,id=failed:1");
            assert.equal(lines[1], "c:server.numRequests,id=failed:2");
            assert.equal(lines[2], "c:server.numRequests,id=failed:3");
        } finally {
            await writer.close();
            messages.length = 0;
        }
    });

    it("flush on buffer full", async (): Promise<void> => {
        const address = server.address();
        // small buffer (50 bytes), long timeout so only size triggers the flush
        const writer = new UdpWriter(location, address.address, address.port, undefined, 50, 60000);

        try {
            await writer.write("c:server.numRequests,id=failed:1");
            await writer.write("c:server.numRequests,id=failed:2");
            await writer.write("c:server.numRequests,id=failed:3");

            // Each line is 32 bytes plus a counted newline. Adding a second line
            // would exceed the 50-byte buffer, so the writer pre-flushes the
            // existing line before appending the next one.
            await sleep(50);

            let lines = messages.flatMap((m) => m.split("\n"));
            assert.equal(lines.length, 2);
            assert.equal(lines[0], "c:server.numRequests,id=failed:1");
            assert.equal(lines[1], "c:server.numRequests,id=failed:2");

            // closing flushes the remaining buffered line
            await writer.close();
            await sleep(10);

            lines = messages.flatMap((m) => m.split("\n"));
            assert.equal(lines.length, 3);
            assert.equal(lines[2], "c:server.numRequests,id=failed:3");
        } finally {
            await writer.close();
            messages.length = 0;
        }
    });

    it("registry forwards buffer size", async (): Promise<void> => {
        // A small buffer configured via Config should reach the UdpWriter: two
        // small increments fit, and the third increment pre-flushes that batch
        // within the sleep window. If the size were not forwarded, the default
        // 32KB buffer would hold the lines until the 15s timer, and nothing
        // would arrive in time — so this asserts the Config -> writer wiring.
        const r = new Registry(new Config(location, undefined, undefined, 70));

        try {
            await r.counter("server.numRequests", {"id": "success"}).increment();
            await r.counter("server.numRequests", {"id": "success"}).increment(2);
            await r.counter("server.numRequests", {"id": "success"}).increment(3);

            await sleep(50);

            const lines = messages.flatMap((m) => m.split("\n"));
            assert.equal(lines.length, 2);
            assert.equal(lines[0], "c:server.numRequests,id=success:1");
            assert.equal(lines[1], "c:server.numRequests,id=success:2");
        } finally {
            await r.close();
            await sleep(10);
            messages.length = 0;
        }
    });

    it("flush on timeout twice", async (): Promise<void> => {
        const address = server.address();
        const writer = new UdpWriter(location, address.address, address.port, undefined, 8192, 50);

        try {
            // first batch
            await writer.write("c:counter:1");
            await writer.write("c:counter:2");

            await sleep(100);

            let lines = messages.flatMap((m) => m.split("\n"));
            assert.equal(lines.length, 2);
            assert.equal(lines[0], "c:counter:1");
            assert.equal(lines[1], "c:counter:2");

            // second batch — timer should reschedule after first flush
            await writer.write("c:counter:3");
            await writer.write("c:counter:4");

            await sleep(100);

            lines = messages.flatMap((m) => m.split("\n"));
            assert.equal(lines.length, 4);
            assert.equal(lines[2], "c:counter:3");
            assert.equal(lines[3], "c:counter:4");
        } finally {
            await writer.close();
            messages.length = 0;
        }
    });

    it("buffer full resets timer", async (): Promise<void> => {
        const address = server.address();
        // small buffer (24 bytes), 200ms timeout
        const writer = new UdpWriter(location, address.address, address.port, undefined, 24, 200);

        try {
            // first write (11 bytes plus counted newline) sets the 200ms timer
            await writer.write("c:counter:1");
            assert.equal(messages.length, 0);

            // second write exactly fills 24 bytes (two 11-byte lines plus newlines),
            // triggering a size-based flush and clearing the original timer.
            await writer.write("c:counter:2");

            await sleep(50);

            let lines = messages.flatMap((m) => m.split("\n"));
            assert.equal(lines.length, 2);

            // write again — a new timer should be set since the old one was cleared
            await writer.write("c:counter:3");

            // wait long enough for the new 200ms timer but not 400ms (which would
            // mean the original timer was still running from the first write)
            await sleep(300);

            lines = messages.flatMap((m) => m.split("\n"));
            assert.equal(lines.length, 3);
            assert.equal(lines[2], "c:counter:3");
        } finally {
            await writer.close();
            messages.length = 0;
        }
    });

    it("preflush starts timer for fresh buffer", async (): Promise<void> => {
        const address = server.address();
        const writer = new UdpWriter(location, address.address, address.port, undefined, 20, 50);

        try {
            await writer.write("c:counter:1");
            await writer.write("c:counter:2");

            // The second line overflows the first batch, so line 1 is preflushed.
            // Line 2 lands in a fresh buffer and must still flush on its own timer.
            await sleep(125);

            const lines = messages.flatMap((m) => m.split("\n"));
            assert.equal(lines.length, 2);
            assert.equal(lines[0], "c:counter:1");
            assert.equal(lines[1], "c:counter:2");
        } finally {
            await writer.close();
            messages.length = 0;
        }
    });

    it("ignores writes after close", async (): Promise<void> => {
        const address = server.address();
        const writer = new UdpWriter(location, address.address, address.port, undefined, 8192, 50);

        await writer.write("c:counter:before-close");
        await writer.close();
        await writer.write("c:counter:after-close");

        await sleep(100);

        const lines = messages.flatMap((m) => m.split("\n"));
        assert.deepEqual(lines, ["c:counter:before-close"]);
        messages.length = 0;
    });

    it("close resolves when initial udp connect emits an error", async (): Promise<void> => {
        const originalLookup = dns.lookup;
        const logger: Logger = {
            trace: (): void => {}, debug: (): void => {}, info: (): void => {},
            warn: (): void => {}, error: (): void => {}, fatal: (): void => {},
        };

        (dns as any).lookup = (...args: any[]): void => {
            const callback = args[args.length - 1] as (err: NodeJS.ErrnoException) => void;
            const err = new Error("forced lookup failure") as NodeJS.ErrnoException;
            err.code = "ENOTFOUND";
            process.nextTick(() => callback(err));
        };

        const writer = new UdpWriter("udp://connect-failure.invalid:1234", "connect-failure.invalid", 1234, logger);

        try {
            await writer.write("c:counter:connect-failure");

            const result = await Promise.race([
                writer.close().then(() => "closed"),
                sleep(100).then(() => "timeout"),
            ]);

            assert.equal(result, "closed");
        } finally {
            (dns as any).lookup = originalLookup;
            try {
                (writer as any)._socket.close();
            } catch {
                // Socket may already be closed if the implementation handles the error.
            }
        }
    });

    it("does not keep a short-lived process alive", async (): Promise<void> => {
        // A registry that is never closed must not stop its process from exiting;
        // the writer's socket used to be a referenced handle, so the loop could
        // never drain. Needs a child process because the symptom is whether a
        // process exits on its own. The delivery assertion is the other half:
        // unreferencing alone would exit with the metric still buffered.
        const address = server.address();
        const child = spawn(process.execPath, ["--input-type=module", "-e", `
            import {Registry, Config} from "nflx-spectator";
            new Registry(new Config("udp://${address.address}:${address.port}"))
                .counter("shortlived").increment();
        `], {stdio: "inherit"});

        // The default flush interval is 15s, so a timeout well under that also
        // proves the exit path flushed rather than the interval timer firing.
        const outcome = await new Promise<string>((resolve): void => {
            const timer = setTimeout((): void => {
                child.kill("SIGKILL");
                resolve("hung");
            }, 5000);
            child.on("exit", (code, signal): void => {
                clearTimeout(timer);
                resolve(signal === "SIGKILL" ? "hung" : `exit:${code}`);
            });
        });

        assert.equal(outcome, "exit:0", "process that created a Registry did not exit on its own");

        await sleep(20);  // tiny pause is necessary to see data

        const lines = messages.flatMap((m) => m.split("\n"));
        assert.deepEqual(lines, ["c:shortlived:1"]);

        messages.length = 0;  // clear server messages
    });

    it("address family", (): void => {
        assert.equal(isIPv4("192.168.1.1"), true);
        assert.equal(isIPv4("2001:0db8:85a3:0000:0000:8a2e:0370:7334"), false);
        assert.equal(isIPv4("::1"), false);
        assert.equal(isIPv4("[::1]"), false);
        assert.equal(isIPv4("invalid-ip"), false);

        assert.equal(isIPv6("192.168.1.1"), false);
        assert.equal(isIPv6("2001:0db8:85a3:0000:0000:8a2e:0370:7334"), true);
        assert.equal(isIPv6("::1"), true);
        assert.equal(isIPv6("[::1]"), false);
        assert.equal(isIPv6("invalid-ip"), false);
    });
});
