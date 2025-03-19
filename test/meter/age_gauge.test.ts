import {assert} from "chai";
import {MemoryWriter} from "../../src/writer/memory_writer.js";
import {Id} from "../../src/meter/id.js";
import {AgeGauge} from "../../src/meter/age_gauge.js";
import {describe, it} from "node:test";

describe("AgeGauge Tests", (): void => {

    const tid = new Id("age_gauge");

    it("now", (): void => {
        const g = new AgeGauge(tid, new MemoryWriter());
        const writer = g.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        g.now();
        assert.equal("A:age_gauge:0", writer.last_line());
    });

    it("set", (): void => {
        const g = new AgeGauge(tid, new MemoryWriter());
        const writer = g.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        g.set(10);
        assert.equal("A:age_gauge:10", writer.last_line());
    });
});
