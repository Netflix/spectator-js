import {get_logger, Logger} from "../logger/logger.js";
import {validate_tags} from "../common_tags.js";

export type Tags = Record<string, string>;

export function tags_toString(tags: Tags): string {
    let result: string = "{";

    if (Object.entries(tags).length > 0) {
        Object.entries(tags).forEach(([k, v]: [string, string]): void => {
            result += `'${k}': '${v}', `;
        });
        result = result.slice(0, -2);
    }

    return result + "}";
}

export class Id {
    /**
     * The name and tags which uniquely identify a Meter instance. The tags are key-value pairs of
     * strings. This class should NOT be used directly. Instead, use the Registry.new_id() method, to
     * ensure that any extra common tags are properly applied to the Meter.
     */

    private INVALID_CHARS: RegExp = new RegExp(/[^-._A-Za-z0-9~^]/g);

    private readonly _logger: Logger;
    private readonly _name: string;
    private readonly _tags: Tags;
    public spectatord_id: string;

    constructor(name: string, tags?: Tags, logger?: Logger) {
        // initialization order in this constructor matters, for logging and testing purposes
        if (logger == undefined) {
            this._logger = get_logger();
        } else {
            this._logger = logger;
        }

        this._name = name;

        if (tags == undefined) {
            this._tags = {}
        } else {
            this._tags = this.validate_tags(tags);
        }

        this.spectatord_id = this.to_spectatord_id(this._name, this._tags);
    }

    private validate_tags(tags: Tags): Tags {
        const valid_tags: Record<string, string> = validate_tags(tags);

        if (Object.entries(tags).length != Object.entries(valid_tags).length) {
            this._logger.warn(`Id(name=${this._name}, tags=${tags_toString(tags)}) is invalid due to tag keys or values which are ` +
            `zero-length strings; proceeding with truncated tags Id(name=${this._name}, tags=${tags_toString(valid_tags)})`);
        }

        return valid_tags;
    }

    private replace_invalid_chars(s: string): string {
        return s.replace(this.INVALID_CHARS, "_");
    }

    private to_spectatord_id(name: string, tags?: Tags): string {
        if (tags == undefined) {
            tags = {};
        }

        let result: string = this.replace_invalid_chars(name);

        const sorted_tags: {[k: string]: string} = Object.fromEntries(Object.entries(tags).sort(
            (a: [string, string], b: [string, string]): number => {
                const kSort: number = a[0].localeCompare(b[0]);
                if (kSort != 0) {
                    return kSort;
                } else {
                    return a[1].localeCompare(b[1]);
                }
            }
        ));

        Object.entries(sorted_tags).forEach(([k, v]: [string, string]): void => {
            k = this.replace_invalid_chars(k);
            v = this.replace_invalid_chars(v);
            result += `,${k}=${v}`;
        });

        return result;
    }

    name(): string {
        return this._name;
    }

    tags(): Tags {
        return structuredClone(this._tags);
    }

    with_tag(k: string, v: string): Id {
        const new_tags: Tags = structuredClone(this._tags);
        new_tags[k] = v;
        return new Id(this._name, new_tags);
    }

    with_tags(tags: Tags): Id {
        if (Object.keys(tags).length == 0) {
            return this;
        }
        const new_tags = {...structuredClone(this._tags), ...tags};
        return new Id(this._name, new_tags);
    }

    toString(): string {
        return `Id(name=${this._name}, tags=${tags_toString(this._tags)})`;
    }
}
