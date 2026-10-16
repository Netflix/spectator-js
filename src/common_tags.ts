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
     * Extract the container and process tags from the Netflix environment variables. These vary
     * per container and per process, so a shared SpectatorD instance cannot add them:
     *
     *   * nf.container - NETFLIX_CONTAINER_NAME (set by the platform to the Kubernetes container
     *                    name), falling back to TITUS_CONTAINER_NAME.
     *   * nf.process   - NETFLIX_PROCESS_NAME (set by the user for each process in the entrypoint).
     *
     * Empty or whitespace-only values are ignored.
     */
    const tags: Record<string, string> = {};
    add_non_empty(tags, "nf.container", "NETFLIX_CONTAINER_NAME", "TITUS_CONTAINER_NAME");
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
