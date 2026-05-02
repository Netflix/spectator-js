import {get_logger, Logger} from "../logger/logger.js";
import {validate_tags} from "../common_tags.js";

export type Tags = Record<string, string>;

/**
 * @internal
 * Precomputed view of a set of already-validated tags (e.g. extra_common_tags
 * on a Registry) so we don't re-validate or re-regex them on every Id
 * construction. Build via {@link Id.precompute_common_tag_data}.
 */
export type CommonTagData = {
    readonly tags: Tags;
    readonly trusted_keys: Set<string>;
    readonly suffix: string;
};

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
    // User-supplied tags only. Common tags live in _common_tag_data so we don't
    // pay for re-validating, re-regexing, or re-iterating them per Id.
    private readonly _tags: Tags;
    private readonly _common_tag_data?: CommonTagData;

    public invalid: boolean = false;
    public spectatord_id: string;

    constructor(name: string, tags?: Tags, logger?: Logger, common_tag_data?: CommonTagData) {
        // initialization order in this constructor matters, for logging and testing purposes
        this._logger = logger ?? get_logger();

        this._name = name;
        this._common_tag_data = common_tag_data;

        this._tags = tags ? this.validate_tags_for_id(tags) : {};

        this.spectatord_id = this.to_spectatord_id(this._name, this._tags, common_tag_data);
    }

    /**
     * Build a {@link CommonTagData} bundle from a set of tags that are known to
     * be already validated (e.g. extra_common_tags from Config). The bundle
     * captures one regex + concat pass so that subsequent Id constructions can
     * reuse the result instead of redoing the work.
     */
    static precompute_common_tag_data(tags: Tags): CommonTagData {
        const trusted_keys = new Set<string>();
        let suffix = "";
        for (const k in tags) {
            trusted_keys.add(k);
            suffix += `,${Id.replace_invalid_chars(k)}=${Id.replace_invalid_chars(tags[k])}`;
        }
        return {tags, trusted_keys, suffix};
    }

    private validate_tags_for_id(tags: Tags): Tags {
        const valid_tags: Record<string, string> = validate_tags(tags);

        if (Object.keys(tags).length !== Object.keys(valid_tags).length) {
            this._logger.warn(`Id(name=${this._name}, tags=${tags_toString(tags)}) is invalid due to tag keys or ` +
            `values which are too short (k < 2, v < 1), or too long (k > 60, v > 120); proceeding with truncated ` +
            `tags Id(name=${this._name}, tags=${tags_toString(valid_tags)})`);
        }

        return valid_tags;
    }

    private static replace_invalid_chars(s: string): string {
        return s.replace(Id.INVALID_CHARS, "_");
    }

    private to_spectatord_id(name: string, tags?: Tags, common_tag_data?: CommonTagData): string {
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

        let result: string = Id.replace_invalid_chars(name);

        if (common_tag_data !== undefined) {
            result += common_tag_data.suffix;
        }

        if (tags !== undefined) {
            const trusted = common_tag_data?.trusted_keys;
            for (const k in tags) {
                if (trusted?.has(k)) continue;
                result += `,${Id.replace_invalid_chars(k)}=${Id.replace_invalid_chars(tags[k])}`;
            }
        }

        return result;
    }

    name(): string {
        return this._name;
    }

    tags(): Tags {
        // Merge with common tags on demand. extra_common_tags are spread last so
        // they win on key collisions, matching the wire-format precedence.
        if (this._common_tag_data === undefined) {
            return {...this._tags};
        }
        return {...this._tags, ...this._common_tag_data.tags};
    }

    with_tag(k: string, v: string): Id {
        const new_tags: Tags = {...this._tags, [k]: v};
        return new Id(this._name, new_tags, undefined, this._common_tag_data);
    }

    with_tags(tags: Tags): Id {
        for (const _k in tags) {
            const new_tags = {...this._tags, ...tags};
            return new Id(this._name, new_tags, undefined, this._common_tag_data);
        }
        return this;
    }

    toString(): string {
        return `Id(name=${this._name}, tags=${tags_toString(this.tags())})`;
    }
}
