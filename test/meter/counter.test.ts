import {assert} from "chai";
import {Counter, Id, MemoryWriter} from "../../src/index.js";
import {describe, it} from "node:test";

describe("Counter Tests", (): void => {

    const tid = new Id("counter");

    it("add delegates to increment", (): void => {
        const c = new Counter(tid, new MemoryWriter());
        const writer = c.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        c.add();
        assert.equal("c:counter:1", writer.last_line());

        c.add(2);
        assert.equal("c:counter:2", writer.last_line());
    });

    it("increment", (): void => {
        const c = new Counter(tid, new MemoryWriter());
        const writer = c.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        c.increment();
        assert.equal("c:counter:1", writer.last_line());

        c.increment(2);
        assert.equal("c:counter:2", writer.last_line());
    });

    it("increment negative", (): void => {
        const c = new Counter(tid, new MemoryWriter());
        const writer = c.writer() as MemoryWriter;
        c.increment(-1);
        assert.isTrue(writer.is_empty());
    });
});
