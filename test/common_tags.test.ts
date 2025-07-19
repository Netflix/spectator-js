import {assert} from "chai";
import {tags_from_env_vars, validate_tags} from "../src/common_tags.js";
import process from "node:process";
import {describe, it} from "node:test";

describe("Common Tags Tests", (): void => {
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
        const keys = ["NETFLIX_PROCESS_NAME", "TITUS_CONTAINER_NAME"];

        for (const key of keys) {
            delete process.env[key];
        }
    }

    it("get tags from env vars", (): void => {
        setup_environment();
        assert.deepEqual(all_expected_tags(), tags_from_env_vars());
        clear_environment();
    });

    it("get tags from env vars with empty vars ignored", (): void => {
        setup_environment();
        process.env.TITUS_CONTAINER_NAME = "";

        const expected_tags: Record<string, string> = all_expected_tags();
        delete expected_tags["nf.container"];
        assert.deepEqual(expected_tags, tags_from_env_vars());

        clear_environment();
    });

    it("get tags from env vars with missing vars ignored", (): void => {
        setup_environment();
        delete process.env.TITUS_CONTAINER_NAME;

        const expected_tags: Record<string, string> = all_expected_tags();
        delete expected_tags["nf.container"];
        assert.deepEqual(expected_tags, tags_from_env_vars());

        clear_environment();
    });

    it("get tags from env vars with whitespace ignored", (): void => {
        setup_environment();
        process.env.TITUS_CONTAINER_NAME = "    main \t\t";
        assert.deepEqual(all_expected_tags(), tags_from_env_vars());
        clear_environment();
    });

    it("validate tags skips zero length strings", (): void => {
        const tags = {"a": "", "": "b", "cc": "1"};
        assert.deepEqual({"cc": "1"}, validate_tags(tags));
    });
});
