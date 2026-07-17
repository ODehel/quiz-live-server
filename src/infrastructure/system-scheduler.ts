import { CancelHandle, Scheduler } from "../common/scheduler.interface";

export class SystemScheduler implements Scheduler {
    schedule(callback: () => void, delayMs: number): CancelHandle {
        const timeout = setTimeout(callback, delayMs);
        return { cancel: () => clearTimeout(timeout) };
    }
}