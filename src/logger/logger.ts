const levels: Record<string, number> = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60
};

export type Logger = {
    trace: (message: string) => void;
    debug: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    fatal: (message: string) => void;
    [key: string]: (message: string) => void;
};

export function get_logger(level_name?: string): Logger {
    const level_filter = (level_name && level_name in levels) ? levels[level_name] : levels.info;

    const logger = {} as Logger;
    logger.is_level_enabled = (name: string): boolean => levels[name] >= level_filter;

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
