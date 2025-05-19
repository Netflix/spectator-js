import {Logger} from "../logger/logger.js";
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

    let writer: WriterUnion;

    if (location == "none") {
        writer = logger == undefined ? new NoopWriter() : new NoopWriter(logger);
    } else if (location == "memory") {
        writer = logger == undefined ? new MemoryWriter() : new MemoryWriter(logger);
    } else if (location == "stderr") {
        writer = logger == undefined ? new StderrWriter() : new StderrWriter(logger);
    } else if (location == "stdout") {
        writer = logger == undefined ? new StdoutWriter() : new StdoutWriter(logger);
    } else if (location == "udp") {
        location = "udp://127.0.0.1:1234"
        const parsed: URL = new URL(location)
        if (logger == undefined) {
            writer = new UdpWriter(location, parsed.hostname, Number(parsed.port));
        } else {
            writer = new UdpWriter(location, parsed.hostname, Number(parsed.port), logger);
        }
    } else if (location.startsWith("file://")) {
        writer = logger == undefined ? new FileWriter(location) : new FileWriter(location, logger);
    } else if (location.startsWith("udp://")) {
        const parsed: URL = new URL(location)
        // convert IPv6 loop-back address from [::1] to ::1, so it works with the socket api
        const hostname: string = parsed.hostname.replace("[::1]", "::1")
        if (logger == undefined) {
            writer = new UdpWriter(location, hostname, Number(parsed.port));
        } else {
            writer = new UdpWriter(location, hostname, Number(parsed.port), logger);
        }
    } else {
        throw new Error(`unsupported Writer location: ${location}`);
    }

    return writer;
}
