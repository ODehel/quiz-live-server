export interface Scheduler {
    schedule(callback: () => void, delayMs: number): void
}