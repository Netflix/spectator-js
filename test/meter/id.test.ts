import {assert} from "chai";
import {Id, Tags} from "../../src/meter/id.js";
import {describe, it} from "node:test";

describe("Id Tests", (): void => {
    it("equals same name", (): void => {
        const id1 = new Id("foo");
        const id2 = new Id("foo");
        assert.equal(id1.spectatord_id, id2.spectatord_id);
    });

    it("equals same tags", (): void => {
        const id1 = new Id("foo", {"a": "1", "b": "2", "c": "3"});
        const id2 = new Id("foo", {"c": "3", "b": "2", "a": "1"});
        assert.equal(id1.spectatord_id, id2.spectatord_id);
    });

    it("illegal chars are replaced", (): void => {
        const id1 = new Id("test`!@#$%^&*()-=~_+[]{}\\|;:'\",<.>/?foo");
        assert.equal("test______^____-_~______________.___foo", id1.spectatord_id);
    });

    it("invalid tags", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const expected: string[] = [
            "WARN: Id(name=foo, tags={'k': ''}) is invalid due to tag keys or values which are zero-length strings; proceeding with truncated tags Id(name=foo, tags={})",
        ];

        const id1 = new Id("foo", {"k": ""});
        assert.equal("Id(name=foo, tags={})", id1.toString());

        assert.deepEqual(expected, messages);
        console.log = f;
    });

    it("name", (): void => {
        const id1 = new Id("foo", {"a": "1"});
        assert.equal("foo", id1.name());
    });

    it("spectatord id", (): void => {
        const id1 = new Id("foo")
        assert.equal("foo", id1.spectatord_id);

        const id2 = new Id("bar", {"a": "1"});
        assert.equal("bar,a=1", id2.spectatord_id);

        const id3 = new Id("baz", {"a": "1", "b": "2"});
        assert.equal("baz,a=1,b=2", id3.spectatord_id);
    });

    it("toString", (): void => {
        const id1 = new Id("foo");
        assert.equal("Id(name=foo, tags={})", id1.toString());

        const id2 = new Id("bar", {"a": "1"});
        assert.equal("Id(name=bar, tags={'a': '1'})", id2.toString());

        const id3 = new Id("baz", {"a": "1", "b": "2", "c": "3"});
        assert.equal("Id(name=baz, tags={'a': '1', 'b': '2', 'c': '3'})", id3.toString());
    });

    it("tags", (): void => {
        const id1 = new Id("foo", {"a": "1"});
        assert.deepEqual({"a": "1"}, id1.tags());
    });

    it("tags defensive copy", (): void => {
        const id1 = new Id("foo", {"a": "1"});
        const tags: Tags = id1.tags();
        tags["b"] = "2";
        assert.deepEqual({"a": "1", "b": "2"}, tags);
        assert.deepEqual({"a": "1"}, id1.tags());
    });

    it("with_tag returns new object", (): void => {
        const id1 = new Id("foo");
        const id2: Id = id1.with_tag("a", "1");
        assert.notEqual(id1.spectatord_id, id2.spectatord_id);
        assert.deepEqual({}, id1.tags());
        assert.deepEqual({"a": "1"}, id2.tags());
    });

    it("with_tags returns new object", (): void => {
        const id1 = new Id("foo");
        const id2: Id = id1.with_tags({"a": "1", "b": "2"});
        assert.notEqual(id1.spectatord_id, id2.spectatord_id);
        assert.deepEqual({}, id1.tags());
        assert.deepEqual({"a": "1", "b": "2"}, id2.tags());
    });
});
