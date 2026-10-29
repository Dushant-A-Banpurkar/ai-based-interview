import type {
  CodingAssignmentContext,
  CodingAssignmentPublic,
  DifficultyMode,
  StoredCodingAssignment,
} from "../types/codingAssignment";

const BANK: StoredCodingAssignment[] = [
  {
    public: {
      problemId: "js-array-filter-01",
      title: "Filter Active Users",
      statement:
        "Write a function that returns only the users whose active property is true.",
      roleAlignment: ["frontend developer", "javascript developer"],
      skillAlignment: ["JavaScript", "arrays"],
      difficulty: "beginner",
      examples: [
        {
          input: '[{ "name": "A", "active": true }, { "name": "B", "active": false }]',
          output: '[{ "name": "A", "active": true }]',
        },
      ],
      constraints: ["Return an empty array when the input is empty."],
      functionSignature: "function filterActiveUsers(users) {}",
      timeLimitSeconds: 300,
    },
    privateTests: [
      {
        input: '[{"name":"A","active":true},{"name":"B","active":false}]',
        expectedOutput: '[{"name":"A","active":true}]',
      },
      { input: "[]", expectedOutput: "[]" },
    ],
  },
];

const difficultyRank: Record<DifficultyMode, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function scoreAssignment(
  assignment: CodingAssignmentPublic,
  context: CodingAssignmentContext,
): number {
  const role = normalize(context.roleTitle);
  const skills = new Set(context.targetSkills.map(normalize));

  const roleMatch = assignment.roleAlignment.some((item) =>
    role.includes(normalize(item)),
  );
  const skillMatches = assignment.skillAlignment.filter((item) =>
    skills.has(normalize(item)),
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
  if (context.codingTimeLimitSeconds < 60) return null;

  const eligible = BANK.filter(
    (assignment) =>
      assignment.public.timeLimitSeconds <= context.codingTimeLimitSeconds,
  );

  return (
    eligible
      .map((assignment) => ({
        assignment,
        score: scoreAssignment(assignment.public, context),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)[0]?.assignment ?? null
  );
}

export function toClientAssignment(
  assignment: StoredCodingAssignment,
): CodingAssignmentPublic {
  return assignment.public;
}
