import {assert} from "chai";
import {get_logger, Logger} from "../../src/index.js";
import {describe, it} from "node:test";
import {pino} from 'pino';
import {once, sink} from 'pino-test';

describe("Logger Tests", (): void => {

    it("integrate with pino", async (): Promise<void> => {
        const stream = sink();
        const log: Logger = pino({level: 'trace'}, stream) as Logger;

        log.trace("trace");
        await once(stream, {level: 10, msg: 'trace'});

        log.debug("debug");
        await once(stream, {level: 20, msg: 'debug'});

        log.info("info");
        await once(stream, {level: 30, msg: 'info'});

        log.warn("warn");
        await once(stream, {level: 40, msg: 'warn'});

        log.error("error");
        await once(stream, {level: 50, msg: 'error'});

        log.fatal("fatal");
        await once(stream, {level: 60, msg: 'fatal'});
    });

    it("default log level is info", (): void => {
        const log1: Logger = get_logger();
        assert.isTrue(log1.is_level_enabled("fatal"));
        assert.isTrue(log1.is_level_enabled("error"));
        assert.isTrue(log1.is_level_enabled("warn"));
        assert.isTrue(log1.is_level_enabled("info"));
        assert.isFalse(log1.is_level_enabled("debug"));
        assert.isFalse(log1.is_level_enabled("trace"));
        assert.isFalse(log1.is_level_enabled("unknown"));

        const log2: Logger = get_logger("x");
        assert.isTrue(log2.is_level_enabled("warn"));
        assert.isTrue(log2.is_level_enabled("info"));
        assert.isFalse(log2.is_level_enabled("debug"));
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
