import {assert} from "chai";
import {StderrWriter, new_writer} from "../../src/index.js";
import {describe, it} from "node:test";

describe("StdoutWriter Tests", (): void => {
    it("intercepted stdout", async (): Promise<void> => {
        const messages: string[] = [];
        const f = process.stdout.write.bind(process.stderr);

        process.stdout.write = (chunk: any, ...args: any[]): boolean => {
            messages.push(chunk.toString());
            return f(chunk, ...args); // Call the original write method to display it
        };

        const writer = new_writer("stdout") as StderrWriter;
        await writer.write("c:server.numRequests,id=failed:1");
        await writer.write("c:server.numRequests,id=failed:2");

        const expected: string[] = [
            "c:server.numRequests,id=failed:1",
            "c:server.numRequests,id=failed:2"
        ];

        assert.deepEqual(messages, expected);

        await writer.close();
        process.stdout.write = f;
    });
});
