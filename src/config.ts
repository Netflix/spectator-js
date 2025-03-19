import {tags_from_env_vars, validate_tags} from "./common_tags.js";
import {is_valid_output_location} from "./writer/new_writer.js";
import {get_logger, Logger} from "./logger/logger.js";
import {Tags} from "./meter/id.js"
import process from "node:process";


export class Config {
    /**
     * Create a new configuration with the provided location, extra common tags, and logger. All fields
     * are optional. The extra common tags are added to every metric, on top of the common tags provided
     * by spectatord.
     *
     * Possible values for `location` are:
     *
     *   * `none`   - Configure a no-op writer that does nothing. Can be used to disable metrics collection.
     *   * `memory` - Write metrics to memory. Useful for testing.
     *   * `stderr` - Write metrics to standard error.
     *   * `stdout` - Write metrics to standard output.
     *   * `udp`    - Write metrics to the default spectatord UDP port. This is the default value.
     *   * `unix`   - Write metrics to the default spectatord Unix Domain Socket. Useful for high-volume scenarios.
     *   * `file:///path/to/file` - Write metrics to a file or a Unix Domain Socket.
     *   * `udp://host:port`      - Write metrics to a UDP socket.
     *
     * The output location can be overridden by configuring an environment variable SPECTATOR_OUTPUT_LOCATION
     * with one of the values listed above. Overriding the output location may be useful for integration testing.
     */

    location: string;
    extra_common_tags: Tags;
    logger: Logger;

    constructor(location: string = "udp", extra_common_tags: Tags = {}, logger: Logger = get_logger()) {
        this.location = this.calculate_location(location);
        this.extra_common_tags = this.calculate_extra_common_tags(extra_common_tags);
        this.logger = logger;
    }

    calculate_extra_common_tags(common_tags: Tags): Tags {
        const merged_tags: Record<string, string> = validate_tags(common_tags);

        // merge common tags with env var tags; env vars take precedence
        const env_var_tags: Record<string, string> = tags_from_env_vars();
        for (const key in env_var_tags) {
            merged_tags[key] = env_var_tags[key];
        }

        return merged_tags;
    }

    calculate_location(location: string): string {
        if (!is_valid_output_location(location)) {
            throw new Error(`spectatord output location is invalid: ${location}`);
        }

        const override = process.env.SPECTATOR_OUTPUT_LOCATION;
        if (override !== undefined) {
            if (!is_valid_output_location(override)) {
                throw new Error(`SPECTATOR_OUTPUT_LOCATION is invalid: ${override}`);
            }
            location = override;
        }

        return location;
    }
}
