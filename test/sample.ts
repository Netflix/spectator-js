import {Config, Registry} from "../src/index.js";
import process from "node:process";

const MAX_DURATION_SECS = 2 * 60;

const registry = new Registry(new Config("unix"));
const counter = registry.counter("sample.counter");

// Node is single-threaded, so there is only ever one worker driving the loop.
const numThreads = 1;

let iterations = 0;
const start = process.hrtime.bigint();
const deadline = start + BigInt(MAX_DURATION_SECS) * 1_000_000_000n;

while (process.hrtime.bigint() < deadline) {
    void counter.increment();
    iterations++;
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
