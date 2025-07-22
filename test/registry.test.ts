import {assert} from "chai";
import {
    AgeGauge,
    Config,
    Counter,
    DistributionSummary,
    Gauge,
    get_logger,
    Id,
    isMemoryWriter,
    MaxGauge,
    MemoryWriter,
    MonotonicCounter,
    MonotonicCounterUint,
    PercentileDistributionSummary,
    PercentileTimer,
    Registry,
    Timer, UdpWriter
} from "../src/index.js";
import {describe, it} from "node:test";

describe("Registry Tests", (): void => {
    it("close", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const c: Counter = r.counter("counter");
        c.increment();
        assert.equal(writer.last_line(), "c:counter:1");

        r.close();
        assert.isTrue(writer.is_empty());
    });

    it("default config", (): void => {
        const r = new Registry();
        assert.isTrue(r.writer() instanceof UdpWriter);
    });

    it("get config", (): void => {
        const r = new Registry();
        assert.equal(r.config().location, "udp", )
        assert.deepEqual(r.config().extra_common_tags, {})
    });

    it("age_gauge", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const g1: AgeGauge = r.age_gauge("age_gauge");
        const g2: AgeGauge = r.age_gauge("age_gauge", {"my-tags": "bar"});
        assert.isTrue(writer.is_empty());

        g1.set(1);
        assert.equal(writer.last_line(), "A:age_gauge:1");

        g2.set(2);
        assert.equal(writer.last_line(), "A:age_gauge,my-tags=bar:2");
    });

    it("invalid age_gauge does not report", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const g1: AgeGauge = r.age_gauge("g");
        assert.isTrue(writer.is_empty());

        g1.set(1);
        assert.isTrue(writer.is_empty());

        const g2: AgeGauge = r.age_gauge_with_id(r.new_id("g"));
        assert.isTrue(writer.is_empty());

        g2.set(1);
        assert.isTrue(writer.is_empty());

        const expected: string[] = [
            "WARN: Id(name=g, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
            "WARN: Id(name=g, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
        ];
        assert.deepEqual(messages, expected);
        console.log = f;
    });

    it("age_gauge_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const g: AgeGauge = r.age_gauge_with_id(r.new_id("age_gauge", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        g.set(0);
        assert.equal(writer.last_line(), "A:age_gauge,extra-tags=foo,my-tags=bar:0");
    });

    it("counter", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const c1: Counter = r.counter("counter");
        const c2: Counter = r.counter("counter", {"my-tags": "bar"});
        assert.isTrue(writer.is_empty());

        c1.increment();
        assert.equal(writer.last_line(), "c:counter:1");

        c2.increment();
        assert.equal(writer.last_line(), "c:counter,my-tags=bar:1");

        c1.increment(2);
        assert.equal(writer.last_line(), "c:counter:2");

        c2.increment(2);
        assert.equal(writer.last_line(), "c:counter,my-tags=bar:2");

        r.counter("counter").increment(3);
        assert.equal(writer.last_line(), "c:counter:3");
    });

    it("invalid counter does not report", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const c1: Counter = r.counter("c");
        assert.isTrue(writer.is_empty());

        c1.increment();
        assert.isTrue(writer.is_empty());

        const c2: Counter = r.counter_with_id(r.new_id("c"));
        assert.isTrue(writer.is_empty());

        c2.increment();
        assert.isTrue(writer.is_empty());

        const expected: string[] = [
            "WARN: Id(name=c, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
            "WARN: Id(name=c, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
        ];
        assert.deepEqual(messages, expected);
        console.log = f;
    });

    it("counter_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const c: Counter = r.counter_with_id(r.new_id("counter", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        c.increment();
        assert.equal(writer.last_line(), "c:counter,extra-tags=foo,my-tags=bar:1");

        c.increment(2);
        assert.equal(writer.last_line(), "c:counter,extra-tags=foo,my-tags=bar:2");

        r.counter("counter", {"my-tags": "bar"}).increment(3);
        assert.equal(writer.last_line(), "c:counter,extra-tags=foo,my-tags=bar:3");
    });

    it("distribution_summary", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const d: DistributionSummary = r.distribution_summary("distribution_summary");
        assert.isTrue(writer.is_empty());

        d.record(42);
        assert.equal(writer.last_line(), "d:distribution_summary:42");
    });

    it("invalid distribution_summary does not report", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const d1: DistributionSummary = r.distribution_summary("d");
        assert.isTrue(writer.is_empty());

        d1.record(42);
        assert.isTrue(writer.is_empty());

        const d2: DistributionSummary = r.distribution_summary_with_id(r.new_id("d"));
        assert.isTrue(writer.is_empty());

        d2.record(42);
        assert.isTrue(writer.is_empty());

        const expected: string[] = [
            "WARN: Id(name=d, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
            "WARN: Id(name=d, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
        ];
        assert.deepEqual(messages, expected);
        console.log = f;
    });

    it("distribution_summary_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const d: DistributionSummary = r.distribution_summary_with_id(r.new_id("distribution_summary", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        d.record(42);
        assert.equal(writer.last_line(), "d:distribution_summary,extra-tags=foo,my-tags=bar:42");
    });

    it("gauge", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const g: Gauge = r.gauge("gauge");
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal(writer.last_line(), "g:gauge:42");
    });

    it("invalid gauge does not report", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const g1: Gauge = r.gauge("g");
        assert.isTrue(writer.is_empty());

        g1.set(42);
        assert.isTrue(writer.is_empty());

        const g2: Gauge = r.gauge_with_id(r.new_id("g"));
        assert.isTrue(writer.is_empty());

        g2.set(42);
        assert.isTrue(writer.is_empty());

        const expected: string[] = [
            "WARN: Id(name=g, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
            "WARN: Id(name=g, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
        ];
        assert.deepEqual(messages, expected);
        console.log = f;
    });

    it("gauge with ttl seconds", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const g: Gauge = r.gauge("gauge", undefined, 120);
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal(writer.last_line(), "g,120:gauge:42");
    });

    it("gauge_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const g: Gauge = r.gauge_with_id(r.new_id("gauge", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal(writer.last_line(), "g:gauge,extra-tags=foo,my-tags=bar:42");
    });

    it("gauge_with_id with ttl seconds", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const g: Gauge = r.gauge_with_id(r.new_id("gauge", {"my-tags": "bar"}), 120);
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal(writer.last_line(), "g,120:gauge,extra-tags=foo,my-tags=bar:42");
    });

    it("max_gauge", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const g: MaxGauge = r.max_gauge("max_gauge");
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal(writer.last_line(), "m:max_gauge:42");
    });

    it("invalid max_gauge does not report", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const g1: MaxGauge = r.max_gauge("g");
        assert.isTrue(writer.is_empty());

        g1.set(42);
        assert.isTrue(writer.is_empty());

        const g2: MaxGauge = r.max_gauge_with_id(r.new_id("g"));
        assert.isTrue(writer.is_empty());

        g2.set(42);
        assert.isTrue(writer.is_empty());

        const expected: string[] = [
            "WARN: Id(name=g, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
            "WARN: Id(name=g, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
        ];
        assert.deepEqual(messages, expected);
        console.log = f;
    });

    it("max_gauge_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const g: MaxGauge = r.max_gauge_with_id(r.new_id("max_gauge", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal(writer.last_line(), "m:max_gauge,extra-tags=foo,my-tags=bar:42");
    });

    it("monotonic_counter", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const c: MonotonicCounter = r.monotonic_counter("monotonic_counter");
        assert.isTrue(writer.is_empty());

        c.set(42);
        assert.equal(writer.last_line(), "C:monotonic_counter:42");
    });

    it("invalid monotonic_counter does not report", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const c1: MonotonicCounter = r.monotonic_counter("c");
        assert.isTrue(writer.is_empty());

        c1.set(42);
        assert.isTrue(writer.is_empty());

        const c2: MonotonicCounter = r.monotonic_counter_with_id(r.new_id("c"));
        assert.isTrue(writer.is_empty());

        c2.set(42);
        assert.isTrue(writer.is_empty());

        const expected: string[] = [
            "WARN: Id(name=c, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
            "WARN: Id(name=c, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
        ];
        assert.deepEqual(messages, expected);
        console.log = f;
    });

    it("monotonic_counter_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const c: MonotonicCounter = r.monotonic_counter_with_id(r.new_id("monotonic_counter", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        c.set(42);
        assert.equal(writer.last_line(), "C:monotonic_counter,extra-tags=foo,my-tags=bar:42");
    });

    it("monotonic_counter_uint", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const c: MonotonicCounterUint = r.monotonic_counter_uint("monotonic_counter_uint");
        assert.isTrue(writer.is_empty());

        c.set(BigInt(42));
        assert.equal(writer.last_line(), "U:monotonic_counter_uint:42");
    });

    it("invalid monotonic_counter_uint does not report", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const c1: MonotonicCounterUint = r.monotonic_counter_uint("c");
        assert.isTrue(writer.is_empty());

        c1.set(BigInt(42));
        assert.isTrue(writer.is_empty());

        const c2: MonotonicCounterUint = r.monotonic_counter_uint_with_id(r.new_id("c"));
        assert.isTrue(writer.is_empty());

        c2.set(BigInt(42));
        assert.isTrue(writer.is_empty());

        const expected: string[] = [
            "WARN: Id(name=c, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
            "WARN: Id(name=c, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
        ];
        assert.deepEqual(messages, expected);
        console.log = f;
    });

    it("monotonic_counter_uint_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const c: MonotonicCounterUint = r.monotonic_counter_uint_with_id(r.new_id("monotonic_counter_uint", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        c.set(BigInt(42));
        assert.equal(writer.last_line(), "U:monotonic_counter_uint,extra-tags=foo,my-tags=bar:42");
    });

    it("new_id", (): void => {
        const r1 = new Registry(new Config("memory"));
        const id1: Id = r1.new_id("id");
        assert.equal(id1.toString(), "Id(name=id, tags={})");

        const r2 = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const id2: Id = r2.new_id("id");
        assert.equal(id2.toString(), "Id(name=id, tags={'extra-tags': 'foo'})");
    });

    it("pct_distribution_summary", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const d: PercentileDistributionSummary = r.pct_distribution_summary("pct_distribution_summary");
        assert.isTrue(writer.is_empty());

        d.record(42);
        assert.equal(writer.last_line(), "D:pct_distribution_summary:42");
    });

    it("invalid pct_distribution_summary does not report", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const d1: PercentileDistributionSummary = r.pct_distribution_summary("d");
        assert.isTrue(writer.is_empty());

        d1.record(42);
        assert.isTrue(writer.is_empty());

        const d2: PercentileDistributionSummary = r.pct_distribution_summary_with_id(r.new_id("d"));
        assert.isTrue(writer.is_empty());

        d2.record(42);
        assert.isTrue(writer.is_empty());

        const expected: string[] = [
            "WARN: Id(name=d, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
            "WARN: Id(name=d, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
        ];
        assert.deepEqual(messages, expected);
        console.log = f;
    });

    it("pct_distribution_summary_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const d: PercentileDistributionSummary = r.pct_distribution_summary_with_id(r.new_id("pct_distribution_summary", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        d.record(42);
        assert.equal(writer.last_line(), "D:pct_distribution_summary,extra-tags=foo,my-tags=bar:42");
    });

    it("pct_timer", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const t: PercentileTimer = r.pct_timer("pct_timer");
        assert.isTrue(writer.is_empty());

        t.record(42);
        assert.equal(writer.last_line(), "T:pct_timer:42");
    });

    it("invalid pct_timer does not report", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const t1: PercentileTimer = r.pct_timer("t");
        assert.isTrue(writer.is_empty());

        t1.record(42);
        assert.isTrue(writer.is_empty());

        const t2: PercentileTimer = r.pct_timer_with_id(r.new_id("t"));
        assert.isTrue(writer.is_empty());

        t2.record(42);
        assert.isTrue(writer.is_empty());

        const expected: string[] = [
            "WARN: Id(name=t, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
            "WARN: Id(name=t, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
        ];
        assert.deepEqual(messages, expected);
        console.log = f;
    });

    it("pct_timer_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const t: PercentileTimer = r.pct_timer_with_id(r.new_id("pct_timer", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        t.record(42);
        assert.equal(writer.last_line(), "T:pct_timer,extra-tags=foo,my-tags=bar:42");
    });

    it("timer", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const t: Timer = r.timer("timer");
        assert.isTrue(writer.is_empty());

        t.record(42);
        assert.equal(writer.last_line(), "t:timer:42");
    });

    it("invalid timer does not report", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const t1: Timer = r.timer("t");
        assert.isTrue(writer.is_empty());

        t1.record(42);
        assert.isTrue(writer.is_empty());

        const t2: Timer = r.timer_with_id(r.new_id("t"));
        assert.isTrue(writer.is_empty());

        t2.record(42);
        assert.isTrue(writer.is_empty());

        const expected: string[] = [
            "WARN: Id(name=t, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
            "WARN: Id(name=t, tags={}) is invalid, because the name is too short (< 2), or it is too long (> 255); metric will not be reported",
        ];
        assert.deepEqual(messages, expected);
        console.log = f;
    });

    it("timer_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const t: Timer = r.timer_with_id(r.new_id("timer", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        t.record(42);
        assert.equal(writer.last_line(), "t:timer,extra-tags=foo,my-tags=bar:42");
    });

    it("writer", (): void => {
        const r = new Registry(new Config("memory"));
        assert.isTrue(isMemoryWriter(r.writer()));
    });

    it("writer debug logging", (): void => {
        const messages: string[] = [];
        const f = console.log;
        console.log = (msg: any): number => messages.push(msg);

        const r = new Registry(new Config("memory", undefined, get_logger("debug")));
        const writer = r.writer() as MemoryWriter;
        assert.isTrue(writer.is_empty());

        const c: Counter = r.counter("counter");
        c.increment();

        r.logger.debug("use registry logger to leave a message");

        const expected = [
            "DEBUG: initialize MemoryWriter",
            "DEBUG: Create Registry with extra_common_tags={}",
            "DEBUG: write line=c:counter:1",
            "DEBUG: use registry logger to leave a message"
        ];
        assert.deepEqual(messages, expected);

        console.log = f;
    });
});
