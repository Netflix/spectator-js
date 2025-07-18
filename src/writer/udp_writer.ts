import {Writer} from "./writer.js";
import {get_logger, Logger} from "../logger/logger.js";
import {createSocket, Socket, SocketType} from "node:dgram";
import {isIPv6} from "node:net";

export class UdpWriter extends Writer {
    /**
     * Writer that outputs data to a UDP socket.
     */

    private readonly _address: string;
    private readonly _port: number;
    private readonly _family: SocketType;
    private _socket: Socket;

    constructor(location: string, address: string, port: number, logger: Logger<string> = get_logger()) {
        super(logger);
        this._logger.debug(`initialize UdpWriter to ${location}`);
        this._address = address;
        this._port = port;

        if (isIPv6(this._address)) {
            this._family = "udp6";
        } else {
            // IPv4 addresses, and anything that does not appear to be an IPv4 or IPv6 address (i.e. hostnames)
            this._family = "udp4";
        }

        this._socket = createSocket(this._family);
    }

    write(line: string): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void, reject: (reason?: any) => void): void => {
            this._logger.debug(`write line=${line}`);
            this._socket.send(line, this._port, this._address, (err: Error | null): void => {
                if (err) {
                    this._logger.error(`failed to write line=${line}: ${err.message}`);
                    reject(err);
                } else {
                    resolve();
                }
            })
        });
    }

    close(): Promise<void> {
        return new Promise((resolve: (value: void | PromiseLike<void>) => void): void => {
            this._socket.close((): void => {
                resolve();
            });
        });
    }
}
