import {assert} from "chai";
import {parse_protocol_line} from "../src/index.js";
import {describe, it} from "node:test";
import {Id} from "../src/meter/id.js";

describe("Protocol Parser Tests", (): void => {
    it("parse invalid lines", (): void => {
        assert.throws((): [string, Id, string] => parse_protocol_line("foo"));
        assert.throws((): [string, Id, string] => parse_protocol_line("foo:bar"));
        assert.throws((): [string, Id, string] => parse_protocol_line("foo:bar,baz-quux"));
    });

    it("parse counter", (): void => {
        const [symbol, id, value] = parse_protocol_line("c:counter:1");
        assert.equal("c", symbol);
        assert.equal("counter", id.name());
        assert.deepEqual({}, id.tags());
        assert.equal("1", value);
    });

    it("parse counter with tag", (): void => {
        const [symbol, id, value] = parse_protocol_line("c:counter,foo=bar:1");
        assert.equal("c", symbol);
        assert.equal("counter", id.name());
        assert.deepEqual({"foo": "bar"}, id.tags());
        assert.equal("1", value);
    });

    it("parse counter with multiple tags", (): void => {
        const [symbol, id, value] = parse_protocol_line("c:counter,foo=bar,baz=quux:1");
        assert.equal("c", symbol);
        assert.equal("counter", id.name());
        assert.deepEqual({"foo": "bar", "baz": "quux"}, id.tags());
        assert.equal("1", value);
    });

    it("parse gauge", (): void => {
        const [symbol, id, value] = parse_protocol_line("g:gauge:1");
        assert.equal("g", symbol);
        assert.equal("gauge", id.name());
        assert.deepEqual({}, id.tags());
        assert.equal("1", value);
    });

    it("parse gauge with ttl", (): void => {
        const [symbol, id, value] = parse_protocol_line("g,120:gauge:1");
        assert.equal("g", symbol);
        assert.equal("gauge", id.name());
        assert.deepEqual({}, id.tags());
        assert.equal("1", value);
    });

    it("parse timer", (): void => {
        const [symbol, id, value] = parse_protocol_line("t:timer:1");
        assert.equal("t", symbol);
        assert.equal("timer", id.name());
        assert.deepEqual({}, id.tags());
        assert.equal("1", value);
    });
});
