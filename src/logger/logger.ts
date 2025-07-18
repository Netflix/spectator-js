const levels: Record<string, number> = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60
};

export type Logger<T extends string | number | symbol> = {
    trace: (message: T) => void;
    debug: (message: T) => void;
    info: (message: T) => void;
    warn: (message: T) => void;
    error: (message: T) => void;
    fatal: (message: T) => void;
    [key: string]: (message: T) => void;
};

export function get_logger(level_name?: string): Logger<string> {
    let level_filter: number;
    if (level_name == undefined || !(level_name in levels)) {
        level_filter = levels.info;
    } else {
        level_filter = levels[level_name];
    }

    const logger: Logger<string> = {
        is_level_enabled: (name: string) => levels[name] >= level_filter,
        trace: function (): void {
            throw new Error("Function not implemented.");
        },
        debug: function (): void {
            throw new Error("Function not implemented.");
        },
        info: function (): void {
            throw new Error("Function not implemented.");
        },
        warn: function (): void {
            throw new Error("Function not implemented.");
        },
        error: function (): void {
            throw new Error("Function not implemented.");
        },
        fatal: function (): void {
            throw new Error("Function not implemented.");
        }
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
