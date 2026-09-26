import { UuidValidator } from "../common/uuid-validator.interface";

export class UuidFormatValidator implements UuidValidator {
    validate(uuid: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
    }
}
