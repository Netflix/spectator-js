import process from "node:process";

type TimerRecorder = {
    record(seconds: number[]): Promise<void>;
};

/**
 * Stopwatch used by timers to record elapsed time with a single stop call.
 */
export class Stopwatch {
    private readonly _recorder: TimerRecorder;
    private readonly _start: [number, number];
    private _stopped: boolean;

    constructor(recorder: TimerRecorder) {
        this._recorder = recorder;
        this._start = process.hrtime();
        this._stopped = false;
    }

    stop(): Promise<void> {
        if (this._stopped) {
            return Promise.resolve();
        }

        this._stopped = true;
        return this._recorder.record(process.hrtime(this._start));
    }
}
