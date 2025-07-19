import {assert} from "chai";
import {StderrWriter, new_writer} from "../../src/index.js";
import {describe, it} from "node:test";

describe("StderrWriter Tests", (): void => {
    it("intercepted stderr", async (): Promise<void> => {
        const data: string[] = [];
        const f = process.stderr.write.bind(process.stderr);

        process.stderr.write = (chunk: any, ...args: any[]): boolean => {
            data.push(chunk.toString());
            return f(chunk, ...args); // Call the original write method to display it
        };

        const writer = new_writer("stderr") as StderrWriter;
        await writer.write("c:server.numRequests,id=failed:1");
        await writer.write("c:server.numRequests,id=failed:2");

        const expected: string[] = [
            "c:server.numRequests,id=failed:1",
            "c:server.numRequests,id=failed:2"
        ];

        assert.deepEqual(data, expected);

        await writer.close();
        process.stderr.write = f;
    });
});
