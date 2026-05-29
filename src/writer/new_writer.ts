import {get_logger, Logger} from "../logger/logger.js";
import {NoopWriter} from "./noop_writer.js";
import {MemoryWriter} from "./memory_writer.js";
import {FileWriter} from "./file_writer.js";
import {UdpWriter} from "./udp_writer.js";
import {UdsWriter} from "./uds_writer.js";
import {URL} from "node:url";
import {StderrWriter} from "./stderr_writer.js";
import {StdoutWriter} from "./stdout_writer.js";

export type WriterUnion = FileWriter | MemoryWriter | NoopWriter | StderrWriter | StdoutWriter | UdpWriter | UdsWriter;

export function is_valid_output_location(location: string): boolean {
    return ["none", "memory", "stderr", "stdout", "udp", "unix"].includes(location) ||
        location.startsWith("file://") ||
        location.startsWith("udp://") ||
        location.startsWith("unix://");
}

export function new_writer(location: string, logger?: Logger, buffer_size_bytes?: number): WriterUnion {
    /**
     * Create a new Writer based on an output location. The optional
     * buffer_size_bytes is forwarded to the buffering writers (UDP and UDS) as
     * their max buffer size; it is ignored by the non-buffering writers.
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
        location = "udp://127.0.0.1:1234";
    }
    if (location == "unix") {
        location = "unix:///run/spectatord/spectatord.unix";
    }
    if (location.startsWith("file://")) {
        return new FileWriter(location, log);
    }
    if (location.startsWith("udp://")) {
        const parsed = new URL(location);
        // convert IPv6 bracket notation [::1] to ::1 for the socket api
        const hostname = parsed.hostname.replace("[::1]", "::1");
        return new UdpWriter(location, hostname, Number(parsed.port), log, buffer_size_bytes);
    }
    if (location.startsWith("unix://")) {
        // unix:///abs/path/socket — strip the scheme to get the filesystem path.
        const path = location.slice("unix://".length);
        try {
            return new UdsWriter(location, path, log, buffer_size_bytes);
        } catch (err) {
            // UDS init only really fails when the spectatord socket is missing
            // or the client bind path isn't writable — both signal "this host
            // has no spectatord." Fall back to UDP so tests and dev
            // environments behave like the historical UDP default (silent
            // drop) instead of crashing at Registry construction. The
            // underlying errno isn't reliably preserved across the
            // statSync/node-unix-socket boundary (node-unix-socket surfaces
            // bind errors with code='Unknown'), so we can't narrow by code —
            // catching all errors here is intentional.
            log.warn(`UDS unavailable (${(err as Error).message}); falling back to udp://127.0.0.1:1234`);
            return new UdpWriter("udp://127.0.0.1:1234", "127.0.0.1", 1234, log, buffer_size_bytes);
        }
    }

    throw new Error(`unsupported Writer location: ${location}`);
}
