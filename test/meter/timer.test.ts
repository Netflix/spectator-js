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
        assert.equal("t:timer:42", writer.last_line());
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
        assert.equal("t:timer:0", writer.last_line());
    });
});
