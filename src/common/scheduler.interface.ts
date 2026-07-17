export interface Scheduler {
    schedule(callback: () => void, delayMs: number): CancelHandle
}

export interface CancelHandle {
    cancel(): void;
}