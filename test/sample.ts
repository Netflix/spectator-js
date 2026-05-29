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
const counter = registry.counter("sample.counter");

console.log(`Writer Type: ${writerType}`);

// Node is single-threaded, so there is only ever one worker driving the loop.
const numThreads = 1;

const YIELD_INTERVAL_NS = 10n * 1_000_000_000n;

let iterations = 0;
const start = process.hrtime.bigint();
const deadline = start + BigInt(MAX_DURATION_SECS) * 1_000_000_000n;
let nextYield = start + YIELD_INTERVAL_NS;

for (let now = start; now < deadline; now = process.hrtime.bigint()) {
    void counter.increment();
    iterations++;
    // The writer buffers synchronously and only flushes when the event loop
    // runs (timer + chained drains). A fully synchronous loop would block the
    // event loop for the whole run, so nothing would ever be sent and the
    // buffer + promise chain would grow without bound, hanging close(). Yield
    // every 10 seconds so the writer drains and memory stays bounded.
    if (now >= nextYield) {
        await new Promise((resolve) => setImmediate(resolve));
        nextYield = process.hrtime.bigint() + YIELD_INTERVAL_NS;
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
