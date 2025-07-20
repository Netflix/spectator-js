import {assert} from "chai";
import {Id, MemoryWriter, MonotonicCounter} from "../../src/index.js";
import {describe, it} from "node:test";

describe("MonotonicCounter Tests", (): void => {

    const tid = new Id("monotonic_counter");

    it("set", (): void => {
        const c = new MonotonicCounter(tid, new MemoryWriter());
        const writer = c.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        c.set(1);
        assert.equal(writer.last_line(), "C:monotonic_counter:1");
    });

    it("set negative", (): void => {
        const c = new MonotonicCounter(tid, new MemoryWriter());
        const writer = c.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        c.set(-1);
        assert.equal(writer.last_line(), "C:monotonic_counter:-1");
    });
});
