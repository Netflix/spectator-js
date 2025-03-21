import {assert} from "chai";
import {MemoryWriter, new_writer} from "../../src/index.js";
import {describe, it} from "node:test";

describe("MemoryWriter Tests", (): void => {

    it("all methods", (): void => {
        const memory_writer = new_writer("memory") as MemoryWriter;
        assert.isTrue(memory_writer.is_empty());

        memory_writer.write("c:counter:1");
        memory_writer.write("g:gauge:2");
        assert.deepEqual(["c:counter:1", "g:gauge:2"], memory_writer.get());
        assert.equal("g:gauge:2", memory_writer.last_line());

        memory_writer.clear();
        assert.isTrue(memory_writer.is_empty());

        memory_writer.write("c:counter:1");
        memory_writer.write("g:gauge:2");
        memory_writer.close();
        assert.isTrue(memory_writer.is_empty());
    });
});
