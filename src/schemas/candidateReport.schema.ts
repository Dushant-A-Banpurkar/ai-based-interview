import { z } from "zod";

export const CandidateReportSchema = z.object({
  executiveSummary: z
    .string()
    .describe(
      "A 2-3 sentence high-level overview of the candidate performance.",
    ),
  overallScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Aggregate score from 0 to 100."),
  recommendation: z.enum([
    "Strong Hire",
    "Hire",
    "Lean Hire",
    "Lean Reject",
    "Reject",
  ]),

  technicalEvaluation: z.object({
    score: z.number().min(1).max(10),
    problemSolvingScore: z.number().min(1).max(10),
    codeQualtiyScore: z.number().min(1).max(10),
    correctnessScore: z.number().min(1).max(10),
    codeAnalysis: z
      .string()
      .describe(
        "Detailed evalutation of source code efficinecy, edge cases, and sandbox text results.",
      ),
    strengths: z.array(z.string()),
    improvements: z.array(z.string()),
  }),

  communicationEvaluation: z.object({
    score: z.number().min(1).max(10),
    clarityAndStructure: z
      .string()
      .describe(
        "Assessment of how well the candidate structured their answers.",
      ),
    deliveryAndConfidence: z
      .string()
      .describe(
        "Analysis combining transcript confidence with Meyda acoustic telemetry (volume stability, pitch variation, hesitation).",
      ),
    fillerWordsObserved: z.array(z.string()),
  }),

  questionBreakdown: z.array(
    z.object({
      questionText: z.string(),
      candidateResponseSummary: z.string(),
      score: z.number().min(1).max(10),
      keyTakeaway: z.string(),
    }),
  ),
  redFlags: z
    .array(z.string())
    .describe(
      "Critical errors, dishonest answers, or failing sandbox executions.",
    ),
  recommendedFollowUps: z
    .array(z.string())
    .describe("Topics for human interviewers to probe in the next round."),
});

export type CandiateReport = z.infer<typeof CandidateReportSchema>;
