import {assert} from "chai";
import {MemoryWriter} from "../../src/writer/memory_writer.js";
import {Id} from "../../src/meter/id.js";
import {PercentileDistributionSummary} from "../../src/meter/percentile_dist_summary.js";
import {describe, it} from "node:test";

describe("PercentileDistributionSummary Tests", (): void => {

    const tid = new Id("percentile_dist_summary");

    it("record", (): void => {
        const d = new PercentileDistributionSummary(tid, new MemoryWriter());
        const writer = d.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        d.record(42);
        assert.equal("D:percentile_dist_summary:42", writer.last_line());
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
        assert.equal("D:percentile_dist_summary:0", writer.last_line());
    });
});
