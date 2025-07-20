import {assert} from "chai";
import {Gauge, Id, MemoryWriter} from "../../src/index.js";
import {describe, it} from "node:test";

describe("Gauge Tests", (): void => {

    const tid = new Id("gauge");

    it("set", (): void => {
        const g = new Gauge(tid, new MemoryWriter());
        const writer = g.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        g.set(1);
        assert.equal(writer.last_line(), "g:gauge:1");
    });

    it("update delegates to set", (): void => {
        const g = new Gauge(tid, new MemoryWriter());
        const writer = g.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        g.update(1);
        assert.equal(writer.last_line(), "g:gauge:1");
    });

    it("ttl_seconds", (): void => {
        const g = new Gauge(tid, new MemoryWriter(), 120);
        const writer = g.writer() as MemoryWriter;
        g.set(42);
        assert.equal(writer.last_line(), "g,120:gauge:42");
    });
});
