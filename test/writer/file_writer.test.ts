import {assert} from "chai";
import {FileWriter, new_writer} from "../../src/index.js";
import {fileURLToPath} from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {after, before, describe, it} from "node:test";

describe("FileWriter Tests", (): void => {

    let tmpdir: string;
    let location: string;

    before((): void => {
        tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "spectator-js-"));
        location = `file://${tmpdir}/print-writer.txt`;
    });

    after((): void => {
        fs.rmSync(tmpdir, {recursive: true, force: true});
    });

    it("temporary file", async (): Promise<void> => {
        const writer = new_writer(location) as FileWriter;
        await writer.write("c:server.numRequests,id=failed:1");
        await writer.write("c:server.numRequests,id=failed:2");

        let data: string = "";

        try {
            data = fs.readFileSync(fileURLToPath(location), "utf8");
        } catch (error) {
            if (error instanceof Error) {
                console.error(`failed to read file: ${error.message}`);
            }
        }

        const expected: string[] = [
            "c:server.numRequests,id=failed:1",
            "c:server.numRequests,id=failed:2"
        ];

        assert.deepEqual(data.trim().split("\n"), expected);
    });
});
