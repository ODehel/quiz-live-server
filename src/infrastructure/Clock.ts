import { IClock } from "../common/IClock";

export class Clock implements IClock {
    now() : Date {
        return new Date()
    }
}