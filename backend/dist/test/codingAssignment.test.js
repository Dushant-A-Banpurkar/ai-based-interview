"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const vitest_1 = require("vitest");
const codingAssignment_service_1 = require("../services/codingAssignment.service");
vitest_1.vi.mock("axios", () => ({ default: { post: vitest_1.vi.fn() } }));
const context = {
    roleTitle: "Software Developer",
    targetSkills: ["arrays"],
    jobDescription: "Build reliable services.",
    difficultyMode: "beginner",
    allowedLanguages: ["javascript"],
    codingTimeLimitSeconds: 480,
};
(0, vitest_1.describe)("coding assignment selection", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.mocked(axios_1.default.post).mockReset();
    });
    (0, vitest_1.it)("selects an assignment aligned with role, target skills, difficulty, and time", () => {
        const assignment = (0, codingAssignment_service_1.selectCodingAssignment)(context);
        (0, vitest_1.expect)(assignment?.public.problemId).toBe("count-positive-numbers");
        (0, vitest_1.expect)(assignment?.public.timeLimitSeconds).toBeLessThanOrEqual(context.codingTimeLimitSeconds);
    });
    (0, vitest_1.it)("does not select an assignment when the target skills do not match", () => {
        (0, vitest_1.expect)((0, codingAssignment_service_1.selectCodingAssignment)({
            ...context,
            targetSkills: ["HTML"],
        })).toBeNull();
    });
    (0, vitest_1.it)("keeps private tests out of the client assignment", () => {
        const assignment = (0, codingAssignment_service_1.selectCodingAssignment)(context);
        (0, vitest_1.expect)(assignment).not.toBeNull();
        const clientAssignment = (0, codingAssignment_service_1.toClientAssignment)(assignment);
        (0, vitest_1.expect)(clientAssignment).not.toHaveProperty("privateTests");
        (0, vitest_1.expect)(clientAssignment).not.toHaveProperty("referenceSolution");
    });
    (0, vitest_1.it)("verifies solved only when every private test passes", async () => {
        vitest_1.vi.mocked(axios_1.default.post).mockImplementation(async (_url, data) => {
            const input = data.stdin;
            return {
                data: {
                    stdout: input.startsWith("5") ? "2\n" : "0\n",
                    status: { id: 3, description: "Accepted" },
                },
            };
        });
        const assignment = (0, codingAssignment_service_1.selectCodingAssignment)(context);
        if (!assignment)
            throw new Error("Expected a matching assignment.");
        await (0, vitest_1.expect)((0, codingAssignment_service_1.verifyCodingAssignment)(assignment, "candidate code", 63)).resolves.toMatchObject({
            passed: 3,
            total: 3,
            solved: true,
        });
    });
    (0, vitest_1.it)("does not mark output mismatches solved when Judge0 reports Accepted", async () => {
        vitest_1.vi.mocked(axios_1.default.post).mockResolvedValue({
            data: { stdout: "incorrect", status: { id: 3, description: "Accepted" } },
        });
        const assignment = (0, codingAssignment_service_1.selectCodingAssignment)(context);
        if (!assignment)
            throw new Error("Expected a matching assignment.");
        await (0, vitest_1.expect)((0, codingAssignment_service_1.verifyCodingAssignment)(assignment, "candidate code", 63)).resolves.toMatchObject({
            passed: 0,
            total: 3,
            solved: false,
        });
    });
});
