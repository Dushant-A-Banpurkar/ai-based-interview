import axios from "axios";
import {
  CodingAssignmentContext,
  CodingAssignmentPublic,
  InterviewDifficulty,
  StoredCodingAssignment,
} from "../types/codingAssignment";

const ASSIGNMENTS: StoredCodingAssignment[] = [
  {
    public: {
      problemId: "count-positive-numbers",
      title: "Count Positive Numbers",
      statement:
        "Read an integer n followed by n integers from standard input. Print how many of the integers are greater than zero.",
      roleAlignment: ["developer", "engineer", "programmer"],
      skillAlignment: [
        "algorithms",
        "arrays",
        "problem solving",
        "javascript",
        "python",
        "cpp",
      ],
      supportedLanguages: ["javascript", "python", "cpp"],
      difficulty: "beginner",
      examples: [{ input: "5\n-2 0 3 4 -1", output: "2" }],
      constraints: ["0 <= n <= 100000"],
      functionSignature:
        "Read n and then n integers from stdin; print the count of positive values.",
      timeLimitSeconds: 300,
    },
    privateTests: [
      { input: "5\n-2 0 3 4 -1", expectedOutput: "2" },
      { input: "4\n0 0 -3 -1", expectedOutput: "0" },
      { input: "0", expectedOutput: "0" },
    ],
  },
  {
    public: {
      problemId: "two-sum-indices",
      title: "Find a Pair",
      statement:
        "Read n, then n integers, then a target integer from standard input. Print the two distinct zero-based indices whose values sum to the target. Exactly one pair exists.",
      roleAlignment: ["developer", "engineer", "programmer"],
      skillAlignment: [
        "algorithms",
        "arrays",
        "hash maps",
        "javascript",
        "python",
        "cpp",
      ],
      supportedLanguages: ["javascript", "python", "cpp"],
      difficulty: "medium",
      examples: [{ input: "4\n2 7 11 15\n9", output: "0 1" }],
      constraints: ["2 <= n <= 100000"],
      functionSignature:
        "Read n, the integer array, and target from stdin; print the two indices.",
      timeLimitSeconds: 480,
    },
    privateTests: [
      { input: "4\n2 7 11 15\n9", expectedOutput: "0 1" },
      { input: "3\n3 2 4\n6", expectedOutput: "1 2" },
      { input: "2\n3 3\n6", expectedOutput: "0 1" },
    ],
  },
  {
    public: {
      problemId: "balanced-brackets",
      title: "Balanced Brackets",
      statement:
        "Read a line containing only (), [], and {}. Print true if every bracket is correctly opened and closed in order; otherwise print false.",
      roleAlignment: ["developer", "engineer", "programmer"],
      skillAlignment: [
        "algorithms",
        "strings",
        "stacks",
        "javascript",
        "python",
        "cpp",
      ],
      supportedLanguages: ["javascript", "python", "cpp"],
      difficulty: "hard",
      examples: [{ input: "{[()]}", output: "true" }],
      constraints: ["0 <= input length <= 100000"],
      functionSignature:
        "Read one line from stdin and print true or false.",
      timeLimitSeconds: 600,
    },
    privateTests: [
      { input: "{[()]}", expectedOutput: "true" },
      { input: "([)]", expectedOutput: "false" },
      { input: "", expectedOutput: "true" },
    ],
  },
];

const difficultyRank: Record<InterviewDifficulty, number> = {
  beginner: 0,
  medium: 1,
  hard: 2,
  extreme: 3,
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeCodingLanguage(language: string): string {
  const normalized = normalize(language);
  if (normalized === "c++") return "cpp";
  if (normalized === "js" || normalized === "node.js") return "javascript";
  if (normalized === "py") return "python";
  return normalized;
}

function scoreAssignment(
  assignment: CodingAssignmentPublic,
  context: CodingAssignmentContext,
): number {
  const role = normalize(context.roleTitle);
  const skills = new Set(context.targetSkills.map(normalizeCodingLanguage));
  const roleMatch = assignment.roleAlignment.some((item) =>
    role.includes(normalize(item)),
  );
  const skillMatches = assignment.skillAlignment.filter((item) =>
    skills.has(normalizeCodingLanguage(item)),
  ).length;
  const difficultyGap = Math.abs(
    difficultyRank[assignment.difficulty] -
      difficultyRank[context.difficultyMode],
  );

  return (roleMatch ? 4 : 0) + skillMatches * 3 - difficultyGap * 2;
}

export function selectCodingAssignment(
  context: CodingAssignmentContext,
): StoredCodingAssignment | null {
  if (
    context.codingTimeLimitSeconds < 60 ||
    context.allowedLanguages.length === 0
  ) {
    return null;
  }

  const supportedLanguages = new Set(
    context.allowedLanguages.map(normalizeCodingLanguage),
  );
  const skills = new Set(context.targetSkills.map(normalizeCodingLanguage));
  const eligible = ASSIGNMENTS.filter(
    ({ public: assignment }) =>
      assignment.timeLimitSeconds <= context.codingTimeLimitSeconds &&
      assignment.supportedLanguages.some((language) =>
        supportedLanguages.has(normalizeCodingLanguage(language)),
      ),
  );

  const best = eligible
    .map((assignment) => ({
      assignment,
      score: scoreAssignment(assignment.public, context),
    }))
    .filter(
      ({ assignment, score }) =>
        score > 0 &&
        assignment.public.skillAlignment.some((skill) =>
          skills.has(normalizeCodingLanguage(skill)),
        ),
    )
    .sort((a, b) => b.score - a.score)[0]?.assignment;

  return best ? structuredClone(best) : null;
}

export function toClientAssignment(
  assignment: StoredCodingAssignment,
): CodingAssignmentPublic {
  return assignment.public;
}

export interface AssignmentVerification {
  passed: number;
  total: number;
  executionStatus: string;
  solved: boolean;
}

interface Judge0Result {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status?: { id?: number; description?: string };
}

function normalizeOutput(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export async function verifyCodingAssignment(
  assignment: StoredCodingAssignment,
  sourceCode: string,
  languageId: number,
): Promise<AssignmentVerification> {
  const judgeUrl = process.env.JUDGE0_URL || "http://localhost:2358";
  let passed = 0;
  let latestStatus = "Not run";

  for (const test of assignment.privateTests) {
    const response = await axios.post<Judge0Result>(
      `${judgeUrl}/submissions?base64_encoded=false&wait=true`,
      {
        source_code: sourceCode,
        language_id: languageId,
        stdin: test.input,
        cpu_time_limit: 2,
      },
      { timeout: 15_000 },
    );
    const result = response.data;
    latestStatus = result.status?.description ?? "Unknown";
    if (
      result.status?.id === 3 &&
      normalizeOutput(result.stdout ?? "") ===
        normalizeOutput(test.expectedOutput)
    ) {
      passed += 1;
    }

    if (result.status?.id !== 3) break;
  }

  return {
    passed,
    total: assignment.privateTests.length,
    executionStatus: latestStatus,
    solved:
      assignment.privateTests.length > 0 &&
      passed === assignment.privateTests.length,
  };
}
