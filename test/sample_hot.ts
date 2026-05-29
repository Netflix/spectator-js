// Hot-loop throughput benchmark — a variant of sample.ts.
//
// sample.ts constructs a new counter every iteration, so its rate is dominated
// by per-call meter creation (Id construction + tag validation). This file
// instead reuses a single counter and just calls increment() in a hot loop, so
// it measures the increment + buffer path with meter creation removed. The
// buffer size is controllable via the second argument, exactly like sample.ts.
import {Config, Registry} from "../src/index.js";
import process from "node:process";
import {setImmediate} from "node:timers";

const MAX_DURATION_SECS = 2 * 60;

function printUsage(): void {
    console.error("Usage: sample_hot [writer_type] [buffer_size_bytes]");
    console.error("  writer_type: udp or unix (default is unix)");
    console.error("  buffer_size_bytes: positive integer (default is the writer default, 32768)");
}

const args = process.argv.slice(2);
if (args.length > 2) {
    printUsage();
    process.exit(1);
}

const writerType = args[0] ?? "unix";
if (writerType !== "udp" && writerType !== "unix") {
    console.error(`Invalid writer type: ${writerType}`);
    printUsage();
    process.exit(1);
}

let bufferSize: number | undefined;
if (args[1] !== undefined) {
    bufferSize = Number(args[1]);
    if (!Number.isInteger(bufferSize) || bufferSize <= 0) {
        console.error(`Invalid buffer size: ${args[1]}`);
        printUsage();
        process.exit(1);
    }
}

const registry = new Registry(new Config(writerType, undefined, undefined, bufferSize));
const tags = {
    location: writerType,
    version: "correct-horse-battery-staple",
};
// Build the counter once and reuse it — this is the difference from sample.ts.
const counter = registry.counter("sample.counter", tags);

console.log(`Writer Type: ${writerType}`);
console.log(`Buffer Size: ${bufferSize ?? "default (32768)"}`);

// Node is single-threaded, so there is only ever one worker driving the loop.
const numThreads = 1;

// The writer buffers each line synchronously and only sends when the event
// loop runs, flushing the *entire* accumulated buffer as one datagram. A
// synchronous loop never yields, so the buffer balloons and the first drain
// tries to send an oversized datagram -> EMSGSIZE ("Message too long"). Yield
// once we've buffered roughly one buffer's worth so the writer's size-triggered
// flush runs and each datagram is ~buffer_size_bytes. This must be bound by
// bytes, not wall-clock time: at high throughput even a sub-second interval
// buffers megabytes, far past the datagram size limit.
const YIELD_BYTES = bufferSize ?? 32 * 1024;  // mirror the writer default when unset
// Approximate on-wire size of one tagged counter line, e.g.
// "c:sample.counter,location=unix,version=correct-horse-battery-staple:1\n".
const LINE_BYTES = `c:sample.counter,location=${writerType},version=correct-horse-battery-staple:1`.length + 1;

let iterations = 0;
let bufferedBytes = 0;
const start = process.hrtime.bigint();
const deadline = start + BigInt(MAX_DURATION_SECS) * 1_000_000_000n;

for (let now = start; now < deadline; now = process.hrtime.bigint()) {
    void counter.increment();
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
