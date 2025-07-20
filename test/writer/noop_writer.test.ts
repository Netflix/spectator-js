import {assert} from "chai";
import {get_logger, new_writer, NoopWriter} from "../../src/index.js";
import {describe, it} from "node:test";

describe("NoopWriter Tests", (): void => {

    it("logs", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const noop_writer = new_writer("none", get_logger("debug")) as NoopWriter;
        noop_writer.write("c:counter:1");
        noop_writer.close();

        const expected: string[] = [
            "DEBUG: initialize NoopWriter",
            "DEBUG: write line=c:counter:1"
        ];

        assert.deepEqual(messages, expected);
        console.log = f;
    });
});
