import { Scheduler } from "../common/scheduler.interface";

export class SystemScheduler implements Scheduler {
    schedule(callback: () => void, delayMs: number): void {
        setTimeout(callback, delayMs);
    }
}