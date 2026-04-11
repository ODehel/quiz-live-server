import { UuidGenerator } from "../common/uuid-generator.interface";
import { uuidv7 } from "uuidv7";

export class Uuidv7Generator implements UuidGenerator {
    generate(): string {
        return uuidv7();
    }
}