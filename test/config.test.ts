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
        assert.equal("udp", config.location);
        clear_environment();
    });

    it("env location override", (): void => {
        process.env.SPECTATOR_OUTPUT_LOCATION = "memory";
        const config = new Config();
        assert.equal("memory", config.location);
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
        assert.equal("udp", config.location);
        assert.deepEqual({"extra-tag": "foo", "nf.container": "main", "nf.process": "nodejs"}, config.extra_common_tags);
        clear_environment();
    });

    it("valid output locations", (): void => {
        assert.equal("none", get_location("none"));
        assert.equal("memory", get_location("memory"));
        assert.equal("stderr", get_location("stderr"));
        assert.equal("stdout", get_location("stdout"));
        assert.equal("udp", get_location("udp"));
        assert.equal("unix", get_location("unix"));
        assert.equal("file://", get_location("file://"));
        assert.equal("udp://", get_location("udp://"));
    });

    it("invalid output location throws", (): void => {
        assert.throws((): string => get_location("foo"));
    });
});
