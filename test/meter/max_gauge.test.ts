import {assert} from "chai";
import {Id, MaxGauge, MemoryWriter} from "../../src/index.js";
import {describe, it} from "node:test";

describe("MaxGauge Tests", (): void => {

    const tid = new Id("max_gauge");

    it("set", (): void => {
        const g = new MaxGauge(tid, new MemoryWriter());
        const writer = g.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        g.set(0);
        assert.equal("m:max_gauge:0", writer.last_line());
    });
});
