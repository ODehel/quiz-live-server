import { describe, expect, it } from "vitest";
import { WsConnectionPolicy } from "./ws-connection-policy";

describe("Websocket connection policy", () => {
    it("admits a first attempt", () => {
        const wsConnectionPolicy: WsConnectionPolicy = new WsConnectionPolicy();
        const isAdmitted = wsConnectionPolicy.admit("192.168.1.100", new Date(2026, 8, 11, 17, 8, 20, 838));
        expect(isAdmitted).toBe(true);
    });
    it("refuses the 16th attempt", () => {
        const now = new Date(2026, 8, 12, 8, 27, 20, 500);
        const wsConnectionPolicy: WsConnectionPolicy = new WsConnectionPolicy();
        for (let index = 0; index < 15; index++) {
            wsConnectionPolicy.admit("192.168.1.100", now);
        }
        const isAdmitted = wsConnectionPolicy.admit("192.168.1.100", now);
        expect(isAdmitted).toBe(false);
    });
    it("admits the 16th attempt one minute later", () => {
        const now = new Date(2026, 8, 12, 8, 27, 20, 500);
        const later = new Date(2026, 8, 12, 8, 28, 20, 501);
        const wsConnectionPolicy: WsConnectionPolicy = new WsConnectionPolicy();
        for (let index = 0; index < 15; index++) {
            wsConnectionPolicy.admit("192.168.1.100", now);
        }
        const isAdmitted = wsConnectionPolicy.admit("192.168.1.100", later);
        expect(isAdmitted).toBe(true);
    });
    it("admits again exactly at the window boundary", () => {
        const now = new Date(2026, 8, 12, 8, 27, 20, 500);
        const later = new Date(2026, 8, 12, 8, 28, 20, 500);
        const wsConnectionPolicy: WsConnectionPolicy = new WsConnectionPolicy();
        for (let index = 0; index < 15; index++) {
            wsConnectionPolicy.admit("192.168.1.100", now);
        }
        const isAdmitted = wsConnectionPolicy.admit("192.168.1.100", later);
        expect(isAdmitted).toBe(true);
    });
});