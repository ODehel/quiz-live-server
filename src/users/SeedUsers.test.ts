import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IUserRepository } from "./IUserRepository";
import { SeedUsers } from './SeedUsers';

const mockRepository: IUserRepository = {
    count: vi.fn().mockResolvedValue(0),
    insert: vi.fn().mockResolvedValue(undefined)
}

describe("CA-1 - création des 11 comptes utilisateurs s'il n'y en a pas encore", () => {
    let userSeed: SeedUsers
    beforeEach(() => {
        vi.clearAllMocks()
        userSeed = new SeedUsers(mockRepository)
    })
    it("should create 11 user accounts if there are none", async () => {
        await userSeed.seed()
        expect(mockRepository.count).toHaveBeenCalled()
        expect(mockRepository.insert).toHaveBeenCalledTimes(11)
    })
    it("should not create user accounts if there are already some", async () => {
        vi.mocked(mockRepository.count).mockResolvedValue(5)
        await userSeed.seed()
        expect(mockRepository.count).toHaveBeenCalled()
        expect(mockRepository.insert).not.toHaveBeenCalled()
    })
})