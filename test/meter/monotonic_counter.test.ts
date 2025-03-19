import {assert} from "chai";
import {MemoryWriter} from "../../src/writer/memory_writer.js";
import {Id} from "../../src/meter/id.js";
import {MonotonicCounter} from "../../src/meter/monotonic_counter.js";
import {describe, it} from "node:test";

describe("MonotonicCounter Tests", (): void => {

    const tid = new Id("monotonic_counter");

    it("set", (): void => {
        const c = new MonotonicCounter(tid, new MemoryWriter());
        const writer = c.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        c.set(1);
        assert.equal("C:monotonic_counter:1", writer.last_line());
    });

    it("set negative", (): void => {
        const c = new MonotonicCounter(tid, new MemoryWriter());
        const writer = c.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        c.set(-1);
        assert.equal("C:monotonic_counter:-1", writer.last_line());
    });
});
