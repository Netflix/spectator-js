import {assert} from "chai";
import {get_logger, Logger} from "../../src/index.js";
import {describe, it} from "node:test";

describe("Logger Tests", (): void => {

    it("default log level is info", (): void => {
        const log: Logger = get_logger();
        assert.isTrue(log.is_level_enabled("fatal"));
        assert.isTrue(log.is_level_enabled("error"));
        assert.isTrue(log.is_level_enabled("warn"));
        assert.isTrue(log.is_level_enabled("info"));
        assert.isFalse(log.is_level_enabled("debug"));
        assert.isFalse(log.is_level_enabled("trace"));
        assert.isFalse(log.is_level_enabled("unknown"));

        const l2: Logger = get_logger("x");
        assert.isTrue(l2.is_level_enabled("warn"));
        assert.isTrue(l2.is_level_enabled("info"));
        assert.isFalse(l2.is_level_enabled("debug"));
    });

    it("log level filter", (): void => {
        const log: Logger = get_logger("debug");
        assert.isTrue(log.is_level_enabled("info"));
        assert.isTrue(log.is_level_enabled("debug"));
        assert.isFalse(log.is_level_enabled("trace"));
    });

    it("write to stdout", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const log: Logger = get_logger("warn");
        log.info("do nothing");
        log.warn("stern warning");
        log.error("error message");

        assert.deepEqual(["WARN: stern warning", "ERROR: error message"], messages);
        console.log = f;
    });
});
