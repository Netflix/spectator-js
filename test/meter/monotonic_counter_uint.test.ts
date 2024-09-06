import {assert} from "chai";
import {MemoryWriter} from "../../src/writer/memory_writer.js";
import {Id} from "../../src/meter/id.js";
import {MonotonicCounterUint} from "../../src/meter/monotonic_counter_uint.js";
import {describe, it} from "node:test";

describe("MonotonicCounterUint Tests", (): void => {

    const tid = new Id("monotonic_counter_uint");

    it("set", (): void => {
        const c = new MonotonicCounterUint(tid, new MemoryWriter());
        const writer = c.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        c.set(BigInt(1));
        assert.equal("U:monotonic_counter_uint:1", writer.last_line());
    });

    it("set negative", (): void => {
        const c = new MonotonicCounterUint(tid, new MemoryWriter());
        const writer = c.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        c.set(BigInt(-1));
        assert.equal("U:monotonic_counter_uint:18446744073709551615", writer.last_line());
    });
});
