import {assert} from "chai";
import {Id, MemoryWriter, Timer} from "../../src/index.js";
import {describe, it} from "node:test";

describe("Timer Tests", (): void => {

    const tid = new Id("timer");

    it("record", (): void => {
        const t = new Timer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        t.record(42);
        assert.equal(writer.last_line(), "t:timer:42");
    });

    it("record negative", (): void => {
        const t = new Timer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;
        t.record(-42);
        assert.isTrue(writer.is_empty());
    });

    it("record zero", (): void => {
        const t = new Timer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;
        t.record(0);
        assert.equal(writer.last_line(), "t:timer:0");
    });

    it("record bigint nanoseconds", (): void => {
        const t = new Timer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;
        t.record(BigInt(1e9));
        assert.equal(writer.last_line(), "t:timer:1");
    });

    it("record latency from hrtime", (): void => {
        let nanos: number = 0;
        let round: number = 1;
        const f: NodeJS.HRTime = process.hrtime;
        Object.defineProperty(process, "hrtime", {
            get(): () => [number, number] {
                return (): [number, number] => {
                    nanos += round * 1e6;  // 1ms lag first time, 2ms second time, etc.
                    ++round;
                    return [0, nanos];
                };
            }
        });

        const start: [number, number] = process.hrtime();

        const t = new Timer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;
        t.record(process.hrtime(start));  // two calls to hrtime = 1ms + 2ms = 3ms
        assert.equal(writer.last_line(), "t:timer:0.003");

        const [seconds, nanoseconds] = process.hrtime(start);
        t.record(seconds, nanoseconds);  // three calls to hrtime = 1ms + 2ms + 3ms = 6ms
        assert.equal(writer.last_line(), "t:timer:0.006");

        Object.defineProperty(process, "hrtime", f);
    });

    it("start stopwatch", async (): Promise<void> => {
        const t = new Timer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;

        const stopwatch = t.start();
        await stopwatch.stop();

        assert.match(writer.last_line(), /^t:timer:/);
    });

    it("stopwatch records once", async (): Promise<void> => {
        const t = new Timer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;

        const stopwatch = t.start();
        await stopwatch.stop();
        const first = writer.last_line();
        await stopwatch.stop();

        assert.equal(writer.get().length, 1);
        assert.equal(writer.last_line(), first);
    });

    it("time records successful callback", async (): Promise<void> => {
        const t = new Timer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;

        const result = await t.time((): string => "ok");

        assert.equal(result, "ok");
        assert.match(writer.last_line(), /^t:timer:/);
    });

    it("time records rejected callback", async (): Promise<void> => {
        const t = new Timer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;
        let message = "";

        try {
            await t.time((): never => {
                throw new Error("boom");
            });
        } catch (error) {
            if (error instanceof Error) {
                message = error.message;
            }
        }

        assert.equal(message, "boom");
        assert.match(writer.last_line(), /^t:timer:/);
    });
});
