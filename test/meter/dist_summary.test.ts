import {assert} from "chai";
import {DistributionSummary, Id, MemoryWriter} from "../../src/index.js";
import {describe, it} from "node:test";

describe("DistributionSummary Tests", (): void => {

    const tid = new Id("dist_summary");

    it("record", (): void => {
        const d = new DistributionSummary(tid, new MemoryWriter());
        const writer = d.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        d.record(42);
        assert.equal(writer.last_line(), "d:dist_summary:42");
    });

    it("record negative", (): void => {
        const d = new DistributionSummary(tid, new MemoryWriter());
        const writer = d.writer() as MemoryWriter;
        d.record(-42);
        assert.isTrue(writer.is_empty());
    });

    it("record zero", (): void => {
        const d = new DistributionSummary(tid, new MemoryWriter());
        const writer = d.writer() as MemoryWriter;
        d.record(0);
        assert.equal(writer.last_line(), "d:dist_summary:0");
    });
});
