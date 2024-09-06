import {assert} from "chai";
import {get_logger} from "../../src/logger/logger.js";
import {new_writer} from "../../src/writer/new_writer.js";
import {describe, it} from "node:test";
import {NoopWriter} from "../../src/writer/noop_writer.js";

describe("NoopWriter Tests", () => {

    it("logs", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const noop_writer = new_writer("none", get_logger("debug")) as NoopWriter;
        noop_writer.write("c:counter:1");
        noop_writer.close();

        const expected_messages: string[] = [
            "DEBUG: initialize NoopWriter",
            "DEBUG: write line=c:counter:1"
        ];

        assert.deepEqual(expected_messages, messages);
        console.log = f;
    });
});
