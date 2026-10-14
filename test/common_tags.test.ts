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
        clear_environment();
        process.env.NETFLIX_PROCESS_NAME = "nodejs";
        process.env.TITUS_CONTAINER_NAME = "main";
    }

    function clear_environment(): void {
        const keys = ["NETFLIX_CONTAINER_NAME", "NETFLIX_PROCESS_NAME", "TITUS_CONTAINER_NAME"];

        for (const key of keys) {
            delete process.env[key];
        }
    }

    it("get tags from env vars", (): void => {
        setup_environment();
        assert.deepEqual(tags_from_env_vars(), all_expected_tags());
        clear_environment();
    });

    it("get tags from env vars with empty vars ignored", (): void => {
        setup_environment();
        process.env.TITUS_CONTAINER_NAME = "";

        const expected_tags: Record<string, string> = all_expected_tags();
        delete expected_tags["nf.container"];
        assert.deepEqual(tags_from_env_vars(), expected_tags);

        clear_environment();
    });

    it("get tags from env vars with missing vars ignored", (): void => {
        setup_environment();
        delete process.env.TITUS_CONTAINER_NAME;

        const expected_tags: Record<string, string> = all_expected_tags();
        delete expected_tags["nf.container"];
        assert.deepEqual(tags_from_env_vars(), expected_tags);

        clear_environment();
    });

    it("get tags from env vars with whitespace ignored", (): void => {
        setup_environment();
        process.env.TITUS_CONTAINER_NAME = "    main \t\t";
        assert.deepEqual(tags_from_env_vars(), all_expected_tags());
        clear_environment();
    });

    it("NETFLIX_CONTAINER_NAME wins over TITUS_CONTAINER_NAME", (): void => {
        setup_environment();
        process.env.NETFLIX_CONTAINER_NAME = "app";

        const expected_tags: Record<string, string> = all_expected_tags();
        expected_tags["nf.container"] = "app";
        assert.deepEqual(tags_from_env_vars(), expected_tags);

        clear_environment();
    });

    it("get nf.container from NETFLIX_CONTAINER_NAME alone", (): void => {
        setup_environment();
        delete process.env.TITUS_CONTAINER_NAME;
        process.env.NETFLIX_CONTAINER_NAME = "  app \t";

        const expected_tags: Record<string, string> = all_expected_tags();
        expected_tags["nf.container"] = "app";
        assert.deepEqual(tags_from_env_vars(), expected_tags);

        clear_environment();
    });

    it("empty or whitespace NETFLIX_CONTAINER_NAME falls back to TITUS_CONTAINER_NAME", (): void => {
        setup_environment();

        process.env.NETFLIX_CONTAINER_NAME = "";
        assert.deepEqual(tags_from_env_vars(), all_expected_tags());

        process.env.NETFLIX_CONTAINER_NAME = "  \t";
        assert.deepEqual(tags_from_env_vars(), all_expected_tags());

        clear_environment();
    });

    it("get tags from env vars with empty process name ignored", (): void => {
        setup_environment();
        process.env.NETFLIX_PROCESS_NAME = "";

        const expected_tags: Record<string, string> = all_expected_tags();
        delete expected_tags["nf.process"];
        assert.deepEqual(tags_from_env_vars(), expected_tags);

        clear_environment();
    });

    it("no tags when no env vars are set", (): void => {
        clear_environment();
        assert.deepEqual(tags_from_env_vars(), {});
    });

    it("validate tags skips zero length strings", (): void => {
        const tags = {"a": "", "": "b", "cc": "1"};
        assert.deepEqual(validate_tags(tags), {"cc": "1"});
    });
});
