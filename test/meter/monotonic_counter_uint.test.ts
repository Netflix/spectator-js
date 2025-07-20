import {assert} from "chai";
import {Id, MemoryWriter, MonotonicCounterUint} from "../../src/index.js";
import {describe, it} from "node:test";

describe("MonotonicCounterUint Tests", (): void => {

    const tid = new Id("monotonic_counter_uint");

    it("set", (): void => {
        const c = new MonotonicCounterUint(tid, new MemoryWriter());
        const writer = c.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        c.set(BigInt(1));
        assert.equal(writer.last_line(), "U:monotonic_counter_uint:1");
    });

    it("set negative", (): void => {
        const c = new MonotonicCounterUint(tid, new MemoryWriter());
        const writer = c.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        c.set(BigInt(-1));
        assert.equal(writer.last_line(), "U:monotonic_counter_uint:18446744073709551615");
    });
});
