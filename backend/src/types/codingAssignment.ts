export type DifficultyMode = "beginner" | "intermediate" | "advanced";

export interface CodingAssignmentContext {
  roleTitle: string;
  targetSkills: string[];
  difficultyMode: DifficultyMode;
  codingTimeLimitSeconds: number;
}

export interface CodingAssignmentPublic {
  problemId: string;
  title: string;
  statement: string;
  roleAlignment: string[];
  skillAlignment: string[];
  difficulty: DifficultyMode;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  constraints: string[];
  functionSignature: string;
  timeLimitSeconds: number;
}

export interface PrivateTestCase {
  input: string;
  expectedOutput: string;
}

export interface StoredCodingAssignment {
  public: CodingAssignmentPublic;
  privateTests: PrivateTestCase[];
  referenceSolution?: Record<string, string>;
}