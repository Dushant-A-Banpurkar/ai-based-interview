export type InterviewDifficulty = "beginner" | "medium" | "hard" | "extreme";

export interface CodingAssignmentContext {
  roleTitle: string;
  targetSkills: string[];
  jobDescription: string;
  difficultyMode: InterviewDifficulty;
  allowedLanguages: string[];
  codingTimeLimitSeconds: number;
}

export interface CodingAssignmentPublic {
  problemId: string;
  title: string;
  statement: string;
  roleAlignment: string[];
  skillAlignment: string[];
  supportedLanguages: string[];
  difficulty: InterviewDifficulty;
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
}
