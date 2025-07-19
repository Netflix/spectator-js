import {assert} from "chai";
import {Id, Tags, tags_toString} from "../../src/index.js";
import {describe, it} from "node:test";

describe("Id Tests", (): void => {
    it("tags_toString for undefined", (): void => {
        assert.equal(tags_toString(undefined), "{}");
    });

    it("equals same name", (): void => {
        const id1 = new Id("foo");
        const id2 = new Id("foo");
        assert.equal(id1.spectatord_id, id2.spectatord_id);
    });

    it("equals same tags", (): void => {
        const id1 = new Id("foo", {"aa": "1", "bb": "2", "cc": "3"});
        const id2 = new Id("foo", {"cc": "3", "bb": "2", "aa": "1"});
        assert.equal(id1.spectatord_id, id2.spectatord_id);
    });

    it("illegal chars are replaced", (): void => {
        const id1 = new Id("test`!@#$%^&*()-=~_+[]{}\\|;:'\",<.>/?foo");
        assert.equal(id1.spectatord_id,"test______^____-_~______________.___foo");
    });

    it("invalid name", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        // name too short
        const id1 = new Id("a");
        assert.equal(id1.toString(), "Id(name=a, tags={})");
        assert.isTrue(id1.invalid);
        assert.equal(id1.spectatord_id, "");

        // name too long
        const long = "a".repeat(256);
        const id2 = new Id(long);
        assert.equal(id2.toString(),"Id(name=" + long +", tags={})" );
        assert.isTrue(id2.invalid);
        assert.equal(id2.spectatord_id, "");

        const expected: string[] = [
            "WARN: Id(name=a, tags={}) is invalid, because the name is not a string, it is too short (< 2), or it is too long (> 255); metric will not be reported",
            "WARN: Id(name=" + long + ", tags={}) is invalid, because the name is not a string, it is too short (< 2), or it is too long (> 255); metric will not be reported",
        ];

        assert.deepEqual(messages, expected);
        console.log = f;
    });

    it("invalid tags", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        // tag ok, tag key too short (< 2), tag value too short (< 1)
        const id1 = new Id("foo", {"aa": "1", "b": "2", "cc": ""});
        assert.equal(id1.toString(), "Id(name=foo, tags={'aa': '1'})");

        // tag ok, tag key too long (> 60), tag value too long (> 120)
        const long_k = "k".repeat(61);
        const long_v = "a".repeat(121);

        const tags: Tags = {};
        tags["aa"] = "1"
        tags[long_k] = "2";
        tags["bb"] = long_v;

        const id2 = new Id("foo", tags);
        assert.equal(id2.toString(), "Id(name=foo, tags={'aa': '1'})");

        const expected: string[] = [
            "WARN: Id(name=foo, tags={'aa': '1', 'b': '2', 'cc': ''}) is invalid due to tag keys or values which are too short (k < 2, v < 1), or too long (k > 60, v > 120); proceeding with truncated tags Id(name=foo, tags={'aa': '1'})",
            "WARN: Id(name=foo, tags={'aa': '1', '" + long_k + "': '2', 'bb': '" + long_v + "'}) is invalid due to tag keys or values which are too short (k < 2, v < 1), or too long (k > 60, v > 120); proceeding with truncated tags Id(name=foo, tags={'aa': '1'})"
        ];

        assert.deepEqual(expected, messages);
        console.log = f;
    });

    it("name", (): void => {
        const id1 = new Id("foo", {"aa": "1"});
        assert.equal(id1.name(), "foo");
    });

    it("spectatord id", (): void => {
        const id1 = new Id("foo")
        assert.equal(id1.spectatord_id, "foo");

        const id2 = new Id("bar", {"aa": "1"});
        assert.equal(id2.spectatord_id, "bar,aa=1");

        const id3 = new Id("baz", {"aa": "1", "bb": "2"});
        assert.equal(id3.spectatord_id, "baz,aa=1,bb=2");
    });

    it("toString", (): void => {
        const id1 = new Id("foo");
        assert.equal(id1.toString(), "Id(name=foo, tags={})");

        const id2 = new Id("bar", {"aa": "1"});
        assert.equal(id2.toString(), "Id(name=bar, tags={'aa': '1'})", );

        const id3 = new Id("baz", {"aa": "1", "bb": "2", "cc": "3"});
        assert.equal(id3.toString(), "Id(name=baz, tags={'aa': '1', 'bb': '2', 'cc': '3'})", );
    });

    it("tags", (): void => {
        const id1 = new Id("foo", {"aa": "1"});
        assert.deepEqual( id1.tags(), {"aa": "1"});
    });

    it("tags defensive copy", (): void => {
        const id1 = new Id("foo", {"aa": "1"});
        const tags: Tags = id1.tags();
        tags["bb"] = "2";
        assert.deepEqual(tags, {"aa": "1", "bb": "2"});
        assert.deepEqual(id1.tags(), {"aa": "1"});
    });

    it("with_tag returns new object", (): void => {
        const id1 = new Id("foo");
        const id2: Id = id1.with_tag("aa", "1");
        assert.notEqual(id1.spectatord_id, id2.spectatord_id);
        assert.deepEqual(id1.tags(), {});
        assert.deepEqual(id2.tags(), {"aa": "1"});
    });

    it("with_tags returns new object", (): void => {
        const id1 = new Id("foo");
        const id2: Id = id1.with_tags({"aa": "1", "bb": "2"});
        assert.notEqual(id1.spectatord_id, id2.spectatord_id);
        assert.deepEqual(id1.tags(), {});
        assert.deepEqual(id2.tags(), {"aa": "1", "bb": "2"});
    });
});
