import {assert} from "chai";
import {Config, new_writer, Registry, UdpWriter} from "../../src/index.js";
import {AddressInfo, isIPv4, isIPv6} from "node:net";
import {createSocket, Socket} from "node:dgram";
import {after, before, beforeEach, describe, it} from "node:test";

describe("UdpWriter Tests", (): void => {

    let server: Socket;
    let location: string;
    const messages: string[] = [];

    function sleep(ms: number): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            setTimeout(resolve, ms);
        });
    }

    function lines(): string[] {
        return messages.flatMap((m) => m.split("\n"));
    }

    async function wait_for_lines(count: number, timeout_ms: number = 500): Promise<string[]> {
        const deadline = Date.now() + timeout_ms;
        let current = lines();
        while (current.length < count && Date.now() < deadline) {
            await sleep(5);
            current = lines();
        }
        return current;
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

    beforeEach((): void => {
        messages.length = 0;
    });

    it("send metrics", async (): Promise<void> => {
        const writer = new_writer(location) as UdpWriter;

        await writer.write("c:server.numRequests,id=failed:1");
        await writer.write("c:server.numRequests,id=failed:2");
        await writer.close();

        // messages are batched into newline-delimited UDP packets
        const lines = await wait_for_lines(2);
        assert.equal(lines.length, 2);
        assert.equal(lines[0], "c:server.numRequests,id=failed:1");
        assert.equal(lines[1], "c:server.numRequests,id=failed:2");
    });

    it("using registry", async (): Promise<void> => {
        const r = new Registry(new Config(location));

        await r.counter("server.numRequests", {"id": "success"}).increment()
        await r.counter("server.numRequests", {"id": "success"}).increment(2)
        await r.close()

        // messages are batched into newline-delimited UDP packets
        const lines = await wait_for_lines(2);
        assert.equal(lines.length, 2);
        assert.equal(lines[0], "c:server.numRequests,id=success:1");
        assert.equal(lines[1], "c:server.numRequests,id=success:2");
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

            const lines = await wait_for_lines(3);
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

            // 3 lines exceed 100 bytes, so a flush should have been triggered.
            const lines = await wait_for_lines(3);
            assert.equal(lines.length, 3);
        } finally {
            await writer.close();
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

            let lines = await wait_for_lines(2);
            assert.equal(lines.length, 2);
            assert.equal(lines[0], "c:counter:1");
            assert.equal(lines[1], "c:counter:2");

            // second batch — timer should reschedule after first flush
            await writer.write("c:counter:3");
            await writer.write("c:counter:4");

            lines = await wait_for_lines(4);
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
        // small buffer (20 bytes), 200ms timeout
        const writer = new UdpWriter(location, address.address, address.port, undefined, 20, 200);

        try {
            // first write (12 bytes) sets the 200ms timer
            await writer.write("c:counter:1");
            assert.equal(messages.length, 0);

            // second write (24 bytes total) exceeds 20 bytes, triggers size-based flush
            await writer.write("c:counter:2");

            let lines = await wait_for_lines(2);
            assert.equal(lines.length, 2);

            // write again — a new timer should be set since the old one was cleared
            await writer.write("c:counter:3");

            // wait long enough for the new 200ms timer but not 400ms (which would
            // mean the original timer was still running from the first write)
            lines = await wait_for_lines(3, 400);
            assert.equal(lines.length, 3);
            assert.equal(lines[2], "c:counter:3");
        } finally {
            await writer.close();
            messages.length = 0;
        }
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
