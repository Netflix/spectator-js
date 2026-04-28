import {get_logger, Logger} from "../logger/logger.js";
import {validate_tags} from "../common_tags.js";

export type Tags = Record<string, string>;

export function tags_toString(tags: Tags | undefined): string {
    if (!tags) {
        return "{}"
    }

    const entries = Object.entries(tags);
    if (entries.length === 0) {
        return "{}";
    }

    return "{" + entries.map(([k, v]) => `'${k}': '${v}'`).join(", ") + "}";
}

export class Id {
    /**
     * The name and tags which uniquely identify a Meter instance. The tags are key-value pairs of
     * strings. This class should NOT be used directly. Instead, use the Registry.new_id() method, to
     * ensure that any extra common tags are properly applied to the Meter.
     */

    private static readonly INVALID_CHARS = /[^-._A-Za-z0-9~^]/g;

    private readonly _logger: Logger;
    private readonly _name: string;
    private readonly _tags: Tags;

    public invalid: boolean = false;
    public spectatord_id: string;

    constructor(name: string, tags?: Tags, logger?: Logger) {
        // initialization order in this constructor matters, for logging and testing purposes
        this._logger = logger ?? get_logger();

        this._name = name;

        this._tags = tags ? this.validate_tags_for_id(tags) : {};

        this.spectatord_id = this.to_spectatord_id(this._name, this._tags);
    }

    private validate_tags_for_id(tags: Tags): Tags {
        const valid_tags: Record<string, string> = validate_tags(tags);

        if (Object.entries(tags).length != Object.entries(valid_tags).length) {
            this._logger.warn(`Id(name=${this._name}, tags=${tags_toString(tags)}) is invalid due to tag keys or ` +
            `values which are too short (k < 2, v < 1), or too long (k > 60, v > 120); proceeding with truncated ` +
            `tags Id(name=${this._name}, tags=${tags_toString(valid_tags)})`);
        }

        return valid_tags;
    }

    private replace_invalid_chars(s: string): string {
        return s.replace(Id.INVALID_CHARS, "_");
    }

    private to_spectatord_id(name: string, tags?: Tags): string {
        // javascript protection check
        if (typeof name !== "string") {
            name = String(name);
        }

        if (name.length < 2 || name.length > 255) {
            this._logger.warn(`Id(name=${name}, tags=${tags_toString(tags)}) is invalid, because the name ` +
                `is too short (< 2), or it is too long (> 255); metric will not be reported`);
            this.invalid = true;
            return '';
        }

        if (tags == undefined) {
            tags = {};
        }

        let result: string = this.replace_invalid_chars(name);

        const sorted_entries = Object.entries(tags).sort(
            (a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])
        );

        for (const [k, v] of sorted_entries) {
            result += `,${this.replace_invalid_chars(k)}=${this.replace_invalid_chars(v)}`;
        }

        return result;
    }

    name(): string {
        return this._name;
    }

    tags(): Tags {
        return {...this._tags};
    }

    with_tag(k: string, v: string): Id {
        const new_tags: Tags = {...this._tags, [k]: v};
        return new Id(this._name, new_tags);
    }

    with_tags(tags: Tags): Id {
        if (Object.keys(tags).length == 0) {
            return this;
        }
        const new_tags = {...this._tags, ...tags};
        return new Id(this._name, new_tags);
    }

    toString(): string {
        return `Id(name=${this._name}, tags=${tags_toString(this._tags)})`;
    }
}
