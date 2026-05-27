import {Config, Registry} from "../src/index.js";

const registry = new Registry(new Config("unix"));
const counter = registry.counter("sample.counter");

setInterval(() => {
    void counter.increment();
}, 10_000);
