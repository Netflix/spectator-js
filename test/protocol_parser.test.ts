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
        assert.equal(symbol, "c");
        assert.equal(id.name(), "counter");
        assert.deepEqual(id.tags(), {});
        assert.equal(value, "1");
    });

    it("parse counter with tag", (): void => {
        const [symbol, id, value] = parse_protocol_line("c:counter,foo=bar:1");
        assert.equal(symbol, "c");
        assert.equal(id.name(), "counter");
        assert.deepEqual(id.tags(), {"foo": "bar"});
        assert.equal(value, "1");
    });

    it("parse counter with multiple tags", (): void => {
        const [symbol, id, value] = parse_protocol_line("c:counter,foo=bar,baz=quux:1");
        assert.equal(symbol, "c");
        assert.equal(id.name(), "counter");
        assert.deepEqual(id.tags(), {"foo": "bar", "baz": "quux"}, );
        assert.equal(value, "1");
    });

    it("parse gauge", (): void => {
        const [symbol, id, value] = parse_protocol_line("g:gauge:1");
        assert.equal(symbol, "g");
        assert.equal(id.name(), "gauge");
        assert.deepEqual(id.tags(), {});
        assert.equal(value, "1");
    });

    it("parse gauge with ttl", (): void => {
        const [symbol, id, value] = parse_protocol_line("g,120:gauge:1");
        assert.equal(symbol, "g");
        assert.equal(id.name(), "gauge");
        assert.deepEqual(id.tags(), {});
        assert.equal(value, "1");
    });

    it("parse timer", (): void => {
        const [symbol, id, value] = parse_protocol_line("t:timer:1");
        assert.equal(symbol, "t");
        assert.equal(id.name(), "timer");
        assert.deepEqual(id.tags(), {});
        assert.equal(value, "1");
    });
});
