// Reproduces "failed to send udp payload: send EMSGSIZE".
//
// The UdpWriter flushes its whole buffer as a SINGLE UDP datagram. The OS caps
// the size of one datagram (on macOS, net.inet.udp.maxdgram defaults to 9216
// bytes; Linux allows up to 65507). When a flushed payload exceeds that cap,
// socket.send() fails with EMSGSIZE — which the writer only logs, it does not
// throw. This script walks the buffer size up until that happens and reports
// the first size that triggers the error.
//
// Run with:  npx tsx test/reproduceBug.ts

import {createSocket, Socket} from "node:dgram";
import {AddressInfo} from "node:net";
// Import directly from the writer module (not ../src/index.js) so this repro
// pulls in only Node builtins — the index also re-exports UdsWriter, which
// needs the node-unix-socket package.
import {UdpWriter} from "../src/writer/udp_writer.js";
import type {Logger} from "../src/logger/logger.js";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// A logger that records every error() message so we can detect EMSGSIZE.
function capturingLogger(errors: string[]): Logger {
    const noop = () => {};
    return {
        trace: noop,
        debug: noop,
        info: noop,
        warn: noop,
        error: (message: string) => errors.push(message),
        fatal: noop,
    };
}

// Sends one datagram of exactly `bufferSize` bytes through a UdpWriter whose
// max buffer is `bufferSize`, so a single write fills the buffer and flushes.
// Returns the EMSGSIZE error message if the send failed, otherwise null.
async function sendDatagramOfSize(
    location: string, address: string, port: number, bufferSize: number,
): Promise<string | null> {
    const errors: string[] = [];
    const logger = capturingLogger(errors);

    // long flush interval so only the size threshold can trigger the flush
    const writer = new UdpWriter(location, address, port, logger, bufferSize, 60000);

    // one line of `bufferSize` ASCII bytes -> payload is exactly bufferSize bytes
    const line = "x".repeat(bufferSize);

    await writer.write(line);
    await writer.close();   // awaits the chained send, so the error is logged by now
    await sleep(5);

    return errors.find((e) => e.includes("EMSGSIZE")) ?? errors[0] ?? null;
}

async function main(): Promise<void> {
    // local UDP sink so we don't depend on a running spectatord
    const server: Socket = createSocket("udp4");
    server.on("error", () => {});           // ignore; we only care about the sender
    server.on("message", () => {});         // drain
    await new Promise<void>((resolve) => server.bind(0, "127.0.0.1", resolve));

    const {address, port} = server.address() as AddressInfo;
    const location = `udp://${address}:${port}`;

    console.log(`UDP sink listening on ${location}\n`);
    console.log("buffer size (bytes)   result");
    console.log("-------------------   ------");

    const START = 1024;        // 1 KiB
    const STEP = 1024;         // grow 1 KiB at a time
    const MAX = 64 * 1024;     // give up past 64 KiB

    let firstFailingSize: number | null = null;
    let lastGoodSize = 0;

    for (let size = START; size <= MAX; size += STEP) {
        const error = await sendDatagramOfSize(location, address, port, size);

        if (error) {
            console.log(`${String(size).padStart(19)}   FAILED: ${error}`);
            firstFailingSize = size;
            break;
        }

        console.log(`${String(size).padStart(19)}   ok`);
        lastGoodSize = size;
    }

    console.log();
    if (firstFailingSize !== null) {
        console.log(`Largest datagram that sent cleanly: ${lastGoodSize} bytes`);
        console.log(`First datagram that failed:         ${firstFailingSize} bytes`);
        console.log(`\nThe default UdpWriter buffer is 32768 bytes — above this`);
        console.log(`threshold — so it triggers EMSGSIZE under load on this OS.`);
    } else {
        console.log(`No EMSGSIZE up to ${MAX} bytes on this OS (limit is higher here).`);
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
