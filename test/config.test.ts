import {assert} from "chai";
import {Config} from "../src/index.js";
import process from "node:process";
import {describe, it} from "node:test";

describe("Config Tests", (): void => {
    function all_expected_tags(): Record<string, string> {
        return {
            "nf.container": "main",
            "nf.process": "nodejs",
        };
    }

    function setup_environment(): void {
        process.env.NETFLIX_PROCESS_NAME = "nodejs";
        process.env.TITUS_CONTAINER_NAME = "main";
    }

    function clear_environment(): void {
        const keys: string[] = ["NETFLIX_PROCESS_NAME", "SPECTATOR_OUTPUT_LOCATION", "TITUS_CONTAINER_NAME"];

        for (const key of keys) {
            delete process.env[key];
        }
    }

    function get_location(location: string): string {
        return new Config(location).location;
    }

    it("default config", (): void => {
        setup_environment();
        const config = new Config();
        assert.deepEqual(all_expected_tags(), config.extra_common_tags);
        assert.equal(config.location, "udp");
        clear_environment();
    });

    it("env location override", (): void => {
        process.env.SPECTATOR_OUTPUT_LOCATION = "memory";
        const config = new Config();
        assert.equal(config.location, "memory");
        clear_environment();
    });

    it("invalid env location override throws", (): void => {
        process.env.SPECTATOR_OUTPUT_LOCATION = "foo";
        assert.throws((): Config => new Config());
        clear_environment();
    });

    it("extra common tags", (): void => {
        setup_environment();
        const config = new Config(undefined, {"extra-tag": "foo"});
        assert.equal(config.location, "udp");
        assert.deepEqual(config.extra_common_tags, {"extra-tag": "foo", "nf.container": "main", "nf.process": "nodejs"});
        clear_environment();
    });

    it("valid output locations", (): void => {
        assert.equal(get_location("none"), "none");
        assert.equal(get_location("memory"), "memory");
        assert.equal(get_location("stderr"), "stderr");
        assert.equal(get_location("stdout"), "stdout");
        assert.equal(get_location("udp"), "udp");
        assert.equal(get_location("file://"), "file://");
        assert.equal(get_location("udp://"), "udp://");
    });

    it("invalid output location throws", (): void => {
        assert.throws((): string => get_location("foo"));
    });
});
