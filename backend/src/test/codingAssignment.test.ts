import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  selectCodingAssignment,
  toClientAssignment,
  verifyCodingAssignment,
} from "../services/codingAssignment.service";

vi.mock("axios", () => ({ default: { post: vi.fn() } }));

const context = {
  roleTitle: "Software Developer",
  targetSkills: ["arrays"],
  jobDescription: "Build reliable services.",
  difficultyMode: "beginner" as const,
  allowedLanguages: ["javascript"],
  codingTimeLimitSeconds: 480,
};

describe("coding assignment selection", () => {
  beforeEach(() => {
    vi.mocked(axios.post).mockReset();
  });

  it("selects an assignment aligned with role, target skills, difficulty, and time", () => {
    const assignment = selectCodingAssignment(context);

    expect(assignment?.public.problemId).toBe("count-positive-numbers");
    expect(assignment?.public.timeLimitSeconds).toBeLessThanOrEqual(
      context.codingTimeLimitSeconds,
    );
  });

  it("does not select an assignment when the target skills do not match", () => {
    expect(
      selectCodingAssignment({
        ...context,
        targetSkills: ["HTML"],
      }),
    ).toBeNull();
  });

  it("keeps private tests out of the client assignment", () => {
    const assignment = selectCodingAssignment(context);
    expect(assignment).not.toBeNull();

    const clientAssignment = toClientAssignment(assignment!);
    expect(clientAssignment).not.toHaveProperty("privateTests");
    expect(clientAssignment).not.toHaveProperty("referenceSolution");
  });

  it("verifies solved only when every private test passes", async () => {
    vi.mocked(axios.post).mockImplementation(async (_url, data) => {
      const input = (data as { stdin: string }).stdin;
      return {
        data: {
          stdout: input.startsWith("5") ? "2\n" : "0\n",
          status: { id: 3, description: "Accepted" },
        },
      } as never;
    });
    const assignment = selectCodingAssignment(context);
    if (!assignment) throw new Error("Expected a matching assignment.");

    await expect(
      verifyCodingAssignment(assignment, "candidate code", 63),
    ).resolves.toMatchObject({
      passed: 3,
      total: 3,
      solved: true,
    });
  });

  it("does not mark output mismatches solved when Judge0 reports Accepted", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { stdout: "incorrect", status: { id: 3, description: "Accepted" } },
    } as never);
    const assignment = selectCodingAssignment(context);
    if (!assignment) throw new Error("Expected a matching assignment.");

    await expect(
      verifyCodingAssignment(assignment, "candidate code", 63),
    ).resolves.toMatchObject({
      passed: 0,
      total: 3,
      solved: false,
    });
  });
});
