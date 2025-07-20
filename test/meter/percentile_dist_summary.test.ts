import {assert} from "chai";
import {Id, MemoryWriter, PercentileDistributionSummary} from "../../src/index.js";
import {describe, it} from "node:test";

describe("PercentileDistributionSummary Tests", (): void => {

    const tid = new Id("percentile_dist_summary");

    it("record", (): void => {
        const d = new PercentileDistributionSummary(tid, new MemoryWriter());
        const writer = d.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        d.record(42);
        assert.equal(writer.last_line(), "D:percentile_dist_summary:42");
    });

    it("record negative", (): void => {
        const d = new PercentileDistributionSummary(tid, new MemoryWriter());
        const writer = d.writer() as MemoryWriter;
        d.record(-42);
        assert.isTrue(writer.is_empty());
    });

    it("record zero", (): void => {
        const d = new PercentileDistributionSummary(tid, new MemoryWriter());
        const writer = d.writer() as MemoryWriter;
        d.record(0);
        assert.equal(writer.last_line(), "D:percentile_dist_summary:0");
    });
});
