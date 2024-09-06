import {Id} from "./meter/id.js";

export function parse_protocol_line(line: string): [string, Id, string] {
    /**
     * Parse a SpectatorD protocol line into component parts. Utility exposed for testing.
     */
    const [symbol_segment, id_segment, value] = line.split(":");
    if (symbol_segment == undefined || id_segment == undefined || value == undefined) {
        throw Error(`invalid protocol line: ${line}`)
    }

    // remove optional parts, such as gauge ttls
    const symbol = symbol_segment.split(",")[0];
    const id = id_segment.split(",");
    const name = id[0];

    const tags: Record<string, string> = {};
    if (id.length > 1) {
        for (const tag of id.slice(1)) {
            const [key, val] = tag.split("=");
            tags[key] = val;
        }
    }

    return [symbol, new Id(name, tags), value];
}
