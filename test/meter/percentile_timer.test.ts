import {assert} from "chai";
import {MemoryWriter} from "../../src/writer/memory_writer.js";
import {Id} from "../../src/meter/id.js";
import {PercentileTimer} from "../../src/meter/percentile_timer.js";
import {describe, it} from "node:test";

describe("PercentileTimer Tests", (): void => {

    const tid = new Id("percentile_timer");

    it("record", (): void => {
        const t = new PercentileTimer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        t.record(42);
        assert.equal("T:percentile_timer:42", writer.last_line());
    });

    it("record negative", (): void => {
        const t = new PercentileTimer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;
        t.record(-42);
        assert.isTrue(writer.is_empty());
    });

    it("record zero", (): void => {
        const t = new PercentileTimer(tid, new MemoryWriter());
        const writer = t.writer() as MemoryWriter;
        t.record(0);
        assert.equal("T:percentile_timer:0", writer.last_line());
    });
});
