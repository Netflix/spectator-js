import {assert} from "chai";
import {new_writer} from "../../src/writer/new_writer.js";
import {UdpWriter} from "../../src/writer/udp_writer.js";
import {AddressInfo, isIPv4, isIPv6} from "node:net";
import {createSocket, Socket} from "node:dgram";
import {after, before, describe, it} from "node:test";
import {Config} from "../../src/config.js";
import {Registry} from "../../src/registry.js";

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

        assert.equal(messages.length, 2);
        assert.equal(messages[0], "c:server.numRequests,id=failed:1");
        assert.equal(messages[1], "c:server.numRequests,id=failed:2");

        messages.length = 0;
    });

    it("using registry", async (): Promise<void> => {
        const r = new Registry(new Config(location));

        await r.counter("server.numRequests", {"id": "success"}).increment()
        await r.counter("server.numRequests", {"id": "success"}).increment(2)
        await r.close()

        await sleep(2);  // tiny pause is necessary to see data

        assert.equal(messages.length, 2);
        assert.equal(messages[0], "c:server.numRequests,id=success:1");
        assert.equal(messages[1], "c:server.numRequests,id=success:2");
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
