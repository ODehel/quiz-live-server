import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemScheduler } from "./system-scheduler";

describe("System scheduler", () => {
    let scheduler: SystemScheduler;
    beforeEach(() => {
        vi.useFakeTimers();
        scheduler = new SystemScheduler();
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it("runs the callback once the delay has passed, and not before", () => {
        const callback = vi.fn();
        scheduler.schedule(callback, 1000);
        vi.advanceTimersByTime(999);
        expect(callback).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });
    it("does not run the callback of a schedule that was cancelled", () => {
        const callback = vi.fn();
        const handle = scheduler.schedule(callback, 1000);
        handle.cancel();
        vi.advanceTimersByTime(1000);
        expect(callback).not.toHaveBeenCalled();
    });
});
