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
    Timer
} from "../src/index.js";
import {describe, it} from "node:test";

describe("Registry Tests", (): void => {
    it("close", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const c: Counter = r.counter("counter");
        c.increment();
        assert.equal("c:counter:1", writer.last_line());

        r.close();
        assert.isTrue(writer.is_empty());
    });

    it("age_gauge", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const g1: AgeGauge = r.age_gauge("age_gauge");
        const g2: AgeGauge = r.age_gauge("age_gauge", {"my-tags": "bar"});
        assert.isTrue(writer.is_empty());

        g1.set(1);
        assert.equal("A:age_gauge:1", writer.last_line());

        g2.set(2);
        assert.equal("A:age_gauge,my-tags=bar:2", writer.last_line());
    });

    it("age_gauge_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const g: AgeGauge = r.age_gauge_with_id(r.new_id("age_gauge", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        g.set(0);
        assert.equal("A:age_gauge,extra-tags=foo,my-tags=bar:0", writer.last_line());
    });

    it("counter", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const c1: Counter = r.counter("counter");
        const c2: Counter = r.counter("counter", {"my-tags": "bar"});
        assert.isTrue(writer.is_empty());

        c1.increment();
        assert.equal("c:counter:1", writer.last_line());

        c2.increment();
        assert.equal("c:counter,my-tags=bar:1", writer.last_line());

        c1.increment(2);
        assert.equal("c:counter:2", writer.last_line());

        c2.increment(2);
        assert.equal("c:counter,my-tags=bar:2", writer.last_line());

        r.counter("counter").increment(3);
        assert.equal("c:counter:3", writer.last_line());
    });

    it("counter_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const c: Counter = r.counter_with_id(r.new_id("counter", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        c.increment();
        assert.equal("c:counter,extra-tags=foo,my-tags=bar:1", writer.last_line());

        c.increment(2);
        assert.equal("c:counter,extra-tags=foo,my-tags=bar:2", writer.last_line());

        r.counter("counter", {"my-tags": "bar"}).increment(3);
        assert.equal("c:counter,extra-tags=foo,my-tags=bar:3", writer.last_line());
    });

    it("distribution_summary", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const d: DistributionSummary = r.distribution_summary("distribution_summary");
        assert.isTrue(writer.is_empty());

        d.record(42);
        assert.equal("d:distribution_summary:42", writer.last_line());
    });

    it("distribution_summary_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const d: DistributionSummary = r.distribution_summary_with_id(r.new_id("distribution_summary", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        d.record(42);
        assert.equal("d:distribution_summary,extra-tags=foo,my-tags=bar:42", writer.last_line());
    });

    it("gauge", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const g: Gauge = r.gauge("gauge");
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal("g:gauge:42", writer.last_line());
    });

    it("gauge with ttl seconds", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const g: Gauge = r.gauge("gauge", undefined, 120);
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal("g,120:gauge:42", writer.last_line());
    });

    it("gauge_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const g: Gauge = r.gauge_with_id(r.new_id("gauge", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal("g:gauge,extra-tags=foo,my-tags=bar:42", writer.last_line());
    });

    it("gauge_with_id with ttl seconds", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const g: Gauge = r.gauge_with_id(r.new_id("gauge", {"my-tags": "bar"}), 120);
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal("g,120:gauge,extra-tags=foo,my-tags=bar:42", writer.last_line());
    });

    it("max_gauge", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const g: MaxGauge = r.max_gauge("max_gauge");
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal("m:max_gauge:42", writer.last_line());
    });

    it("max_gauge_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const g: MaxGauge = r.max_gauge_with_id(r.new_id("max_gauge", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        g.set(42);
        assert.equal("m:max_gauge,extra-tags=foo,my-tags=bar:42", writer.last_line());
    });

    it("monotonic_counter", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const c: MonotonicCounter = r.monotonic_counter("monotonic_counter");
        assert.isTrue(writer.is_empty());

        c.set(42);
        assert.equal("C:monotonic_counter:42", writer.last_line());
    });

    it("monotonic_counter_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const c: MonotonicCounter = r.monotonic_counter_with_id(r.new_id("monotonic_counter", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        c.set(42);
        assert.equal("C:monotonic_counter,extra-tags=foo,my-tags=bar:42", writer.last_line());
    });

    it("monotonic_counter_uint", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const c: MonotonicCounterUint = r.monotonic_counter_uint("monotonic_counter_uint");
        assert.isTrue(writer.is_empty());

        c.set(BigInt(42));
        assert.equal("U:monotonic_counter_uint:42", writer.last_line());
    });

    it("monotonic_counter_uint_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const c: MonotonicCounterUint = r.monotonic_counter_uint_with_id(r.new_id("monotonic_counter_uint", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        c.set(BigInt(42));
        assert.equal("U:monotonic_counter_uint,extra-tags=foo,my-tags=bar:42", writer.last_line());
    });

    it("new_id", (): void => {
        const r1 = new Registry(new Config("memory"));
        const id1: Id = r1.new_id("id");
        assert.equal("Id(name=id, tags={})", id1.toString());

        const r2 = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const id2: Id = r2.new_id("id");
        assert.equal("Id(name=id, tags={'extra-tags': 'foo'})", id2.toString());
    });

    it("pct_distribution_summary", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const d: PercentileDistributionSummary = r.pct_distribution_summary("pct_distribution_summary");
        assert.isTrue(writer.is_empty());

        d.record(42);
        assert.equal("D:pct_distribution_summary:42", writer.last_line());
    });

    it("pct_distribution_summary_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const d: PercentileDistributionSummary = r.pct_distribution_summary_with_id(r.new_id("pct_distribution_summary", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        d.record(42);
        assert.equal("D:pct_distribution_summary,extra-tags=foo,my-tags=bar:42", writer.last_line());
    });

    it("pct_timer", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const t: PercentileTimer = r.pct_timer("pct_timer");
        assert.isTrue(writer.is_empty());

        t.record(42);
        assert.equal("T:pct_timer:42", writer.last_line());
    });

    it("pct_timer_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const t: PercentileTimer = r.pct_timer_with_id(r.new_id("pct_timer", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        t.record(42);
        assert.equal("T:pct_timer,extra-tags=foo,my-tags=bar:42", writer.last_line());
    });

    it("timer", (): void => {
        const r = new Registry(new Config("memory"));
        const writer = r.writer() as MemoryWriter;

        const t: Timer = r.timer("timer");
        assert.isTrue(writer.is_empty());

        t.record(42);
        assert.equal("t:timer:42", writer.last_line());
    });

    it("timer_with_id", (): void => {
        const r = new Registry(new Config("memory", {"extra-tags": "foo"}));
        const writer = r.writer() as MemoryWriter;

        const t: Timer = r.timer_with_id(r.new_id("timer", {"my-tags": "bar"}));
        assert.isTrue(writer.is_empty());

        t.record(42);
        assert.equal("t:timer,extra-tags=foo,my-tags=bar:42", writer.last_line());
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

        const expected_messages = [
            "DEBUG: initialize MemoryWriter",
            "DEBUG: Create Registry with extra_common_tags={}",
            "DEBUG: write line=c:counter:1"
        ];
        assert.deepEqual(expected_messages, messages);

        console.log = f;
    });
});
