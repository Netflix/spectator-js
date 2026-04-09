import {get_logger, Logger} from "../logger/logger.js";
import {NoopWriter} from "./noop_writer.js";
import {MemoryWriter} from "./memory_writer.js";
import {FileWriter} from "./file_writer.js";
import {UdpWriter} from "./udp_writer.js";
import {URL} from "node:url";
import {StderrWriter} from "./stderr_writer.js";
import {StdoutWriter} from "./stdout_writer.js";

export type WriterUnion = FileWriter | MemoryWriter | NoopWriter | StderrWriter | StdoutWriter | UdpWriter;

export function is_valid_output_location(location: string): boolean {
    return ["none", "memory", "stderr", "stdout", "udp"].includes(location) ||
        location.startsWith("file://") ||
        location.startsWith("udp://");
}

export function new_writer(location: string, logger?: Logger): WriterUnion {
    /**
     * Create a new Writer based on an output location.
     */

    const log = logger ?? get_logger();

    if (location == "none") {
        return new NoopWriter(log);
    }
    if (location == "memory") {
        return new MemoryWriter(log);
    }
    if (location == "stderr") {
        return new StderrWriter(log);
    }
    if (location == "stdout") {
        return new StdoutWriter(log);
    }
    if (location == "udp") {
        location = "udp://127.0.0.1:1234"
        const parsed = new URL(location);
        return new UdpWriter(location, parsed.hostname, Number(parsed.port), log);
    }
    if (location.startsWith("file://")) {
        return new FileWriter(location, log);
    }
    if (location.startsWith("udp://")) {
        const parsed = new URL(location);
        // convert IPv6 loop-back address from [::1] to ::1, so it works with the socket api
        const hostname = parsed.hostname.replace("[::1]", "::1");
        return new UdpWriter(location, hostname, Number(parsed.port), log);
    }

    throw new Error(`unsupported Writer location: ${location}`);
}
