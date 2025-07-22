import process from "node:process";

function add_non_empty(tags: Record<string, string>, tag: string, ...env_vars: string[]): void {
    for (const env_var of env_vars) {
        let value = process.env[env_var];
        if (value == undefined) {
            continue;
        }
        value = value.toString().trim();
        if (value.length > 0) {
            tags[tag] = value;
            break;
        }
    }
}

export function tags_from_env_vars(): Record<string, string> {
    /**
     * Extract common infrastructure tags from the Netflix environment variables, which are
     * specific to a process and thus cannot be managed by a shared SpectatorD instance.
     */
    const tags: Record<string, string> = {};
    add_non_empty(tags, "nf.container", "TITUS_CONTAINER_NAME");
    add_non_empty(tags, "nf.process", "NETFLIX_PROCESS_NAME");
    return tags;
}

export function validate_tags(tags: Record<string, string>): Record<string, string> {
    const valid_tags: Record<string, string> = {};

    for (let key in tags) {
        let val = tags[key];
        // javascript protection checks
        if (typeof key !== "string") key = String(key);
        if (typeof val !== "string") val = String(val);
        if (key.length < 2 || key.length > 60 || val.length < 1 || val.length > 120) continue;
        valid_tags[key] = val;
    }

    return valid_tags;
}
