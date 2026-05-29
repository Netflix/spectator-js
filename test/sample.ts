import {Config, Registry} from "../src/index.js";
import process from "node:process";
import {setImmediate} from "node:timers";

const MAX_DURATION_SECS = 2 * 60;

function printUsage(): void {
    console.error("Usage: sample [writer_type]");
    console.error("  writer_type: udp or unix (default is unix)");
}

const args = process.argv.slice(2);
if (args.length > 1) {
    printUsage();
    process.exit(1);
}

const writerType = args[0] ?? "unix";
if (writerType !== "udp" && writerType !== "unix") {
    console.error(`Invalid writer type: ${writerType}`);
    printUsage();
    process.exit(1);
}

const registry = new Registry(new Config(writerType));
const tags = {
    location: writerType,
    version: "correct-horse-battery-staple",
};

console.log(`Writer Type: ${writerType}`);

// Node is single-threaded, so there is only ever one worker driving the loop.
const numThreads = 1;

// The writer buffers each line synchronously and only sends when the event
// loop runs, flushing the *entire* accumulated buffer as one datagram. A
// synchronous loop never yields, so the buffer balloons and the first drain
// tries to send an oversized datagram -> EMSGSIZE ("Message too long"). Yield
// once we've buffered ~16KB so each datagram stays well under the OS limit.
// This must be bound by bytes, not wall-clock time: at high throughput even a
// sub-second interval buffers megabytes, far past the datagram size limit.
const YIELD_BYTES = 16 * 1024;
// Approximate on-wire size of one tagged counter line, e.g.
// "c:sample.counter,location=unix,version=correct-horse-battery-staple:1\n".
const LINE_BYTES = `c:sample.counter,location=${writerType},version=correct-horse-battery-staple:1`.length + 1;

let iterations = 0;
let bufferedBytes = 0;
const start = process.hrtime.bigint();
const deadline = start + BigInt(MAX_DURATION_SECS) * 1_000_000_000n;

for (let now = start; now < deadline; now = process.hrtime.bigint()) {
    void registry.counter("sample.counter", tags).increment();
    iterations++;
    bufferedBytes += LINE_BYTES;
    if (bufferedBytes >= YIELD_BYTES) {
        await new Promise((resolve) => setImmediate(resolve));
        bufferedBytes = 0;
    }
}

const elapsed = Number(process.hrtime.bigint() - start) / 1e9;
const rate = iterations / elapsed;

console.log("\nPerformance Test Summary:");
console.log(`Threads used: ${numThreads}`);
console.log(`Iterations completed: ${iterations}`);
console.log(`Total elapsed time: ${elapsed.toFixed(2)} seconds`);
console.log(`Rate: ${rate.toFixed(2)} iterations/second`);
console.log(`Rate per thread: ${(rate / numThreads).toFixed(2)} iterations/second/thread`);

await registry.close();
