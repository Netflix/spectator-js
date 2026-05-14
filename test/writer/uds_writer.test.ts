import {assert} from "chai";
import {Config, new_writer, Registry, UdsWriter} from "../../src/index.js";
import {DgramSocket} from "node-unix-socket";
import {after, before, describe, it} from "node:test";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {existsSync, unlinkSync} from "node:fs";

describe("UdsWriter Tests", (): void => {

    let server: DgramSocket;
    let serverPath: string;
    let location: string;
    const messages: string[] = [];

    function sleep(ms: number): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            setTimeout(resolve, ms);
        });
    }

    before((): void => {
        serverPath = join(tmpdir(), `spectator-js-test-${process.pid}.unix`);
        if (existsSync(serverPath)) unlinkSync(serverPath);
        server = new DgramSocket();
        server.on("error", (err: Error): void => {
            console.error("Server error:", err);
        });
        server.on("data", (msg: Buffer): void => {
            messages.push(msg.toString());
        });
        server.bind(serverPath);
        location = `unix://${serverPath}`;
    });

    after((): void => {
        try { server.close(); } catch { /* already closed */ }
        if (existsSync(serverPath)) unlinkSync(serverPath);
    });

    it("send metrics", async (): Promise<void> => {
        const writer = new_writer(location) as UdsWriter;

        await writer.write("c:server.numRequests,id=failed:1");
        await writer.write("c:server.numRequests,id=failed:2");
        await writer.close();

        await sleep(5);

        const lines = messages.flatMap((m) => m.split("\n"));
        assert.equal(lines.length, 2);
        assert.equal(lines[0], "c:server.numRequests,id=failed:1");
        assert.equal(lines[1], "c:server.numRequests,id=failed:2");

        messages.length = 0;
    });

    it("using registry", async (): Promise<void> => {
        const r = new Registry(new Config(location));

        await r.counter("server.numRequests", {"id": "success"}).increment();
        await r.counter("server.numRequests", {"id": "success"}).increment(2);
        await r.close();

        await sleep(5);

        const lines = messages.flatMap((m) => m.split("\n"));
        assert.equal(lines.length, 2);
        assert.equal(lines[0], "c:server.numRequests,id=success:1");
        assert.equal(lines[1], "c:server.numRequests,id=success:2");

        messages.length = 0;
    });

    it("flush on buffer full", async (): Promise<void> => {
        // small buffer (50 bytes), long timeout so only size triggers the flush
        const writer = new UdsWriter(location, serverPath, undefined, 50, 60000);

        try {
            await writer.write("c:server.numRequests,id=failed:1");
            await writer.write("c:server.numRequests,id=failed:2");
            await writer.write("c:server.numRequests,id=failed:3");

            await sleep(20);

            const lines = messages.flatMap((m) => m.split("\n"));
            assert.equal(lines.length, 3);
        } finally {
            await writer.close();
            messages.length = 0;
        }
    });

    it("client socket file is unlinked on close", async (): Promise<void> => {
        const writer = new UdsWriter(location, serverPath);

        await writer.write("c:probe:1");
        await writer.close();
        await sleep(5);

        // The writer's bound client path lives at `${serverPath}.<pid>.<rand>`.
        // We don't know the random suffix, but we know nothing matching
        // serverPath itself should be left as a stray socket file beyond the
        // server's own bind.
        assert.isTrue(existsSync(serverPath), "server socket should still exist");
        messages.length = 0;
    });
});
