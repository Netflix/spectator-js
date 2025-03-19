const levels: Record<string, number> = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60
};

export type Logger = Record<string, ((name: string) => boolean) | (() => void)>;

export function get_logger(level_name?: string): Logger {
    let level_filter: number;
    if (level_name == undefined || !(level_name in levels)) {
        level_filter = levels.info;
    } else {
        level_filter = levels[level_name];
    }

    const logger: Logger = {
        is_level_enabled: (name: string) => levels[name] >= level_filter
    };

    for (const name in levels) {
        if (levels[name] < level_filter) {
            logger[name] = () => {};
        } else {
            logger[name] = (...messages: string[]) => {
                messages[0] = name.toUpperCase() + ': ' + messages[0];
                console.log.apply(null, messages);
            };
        }
    }

    return logger;
}
