import { Clock } from "../common/clock.interface";

export class SystemClock implements Clock {
    now() : Date {
        return new Date()
    }
}