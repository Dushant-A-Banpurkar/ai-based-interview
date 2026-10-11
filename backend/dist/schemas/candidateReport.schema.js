"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandidateReportSchema = void 0;
const zod_1 = require("zod");
exports.CandidateReportSchema = zod_1.z.object({
    executiveSummary: zod_1.z
        .string()
        .describe("A 2-3 sentence high-level overview of the candidate performance."),
    overallScore: zod_1.z
        .number()
        .min(0)
        .max(100)
        .describe("Aggregate score from 0 to 100."),
    recommendation: zod_1.z.enum([
        "Strong Hire",
        "Hire",
        "No Hire",
        "Strong Reject"
    ]),
    technicalEvaluation: zod_1.z.object({
        score: zod_1.z.number().min(1).max(100),
        problemSolvingScore: zod_1.z.number().min(1).max(10),
        codeQualityScore: zod_1.z.number().min(1).max(10),
        correctnessScore: zod_1.z.number().min(1).max(10),
        codeAnalysis: zod_1.z
            .string()
            .describe("Detailed evalutation of source code efficinecy, edge cases, and sandbox text results."),
        strengths: zod_1.z.array(zod_1.z.string()),
        improvements: zod_1.z.array(zod_1.z.string()),
    }),
    communicationEvaluation: zod_1.z.object({
        score: zod_1.z.number().min(1).max(10),
        clarityAndStructure: zod_1.z
            .string()
            .describe("Assessment of how well the candidate structured their answers."),
        deliveryAndConfidence: zod_1.z
            .string()
            .describe("Analysis combining transcript confidence with Meyda acoustic telemetry (volume stability, pitch variation, hesitation)."),
        fillerWordsObserved: zod_1.z.array(zod_1.z.string()),
    }),
    questionBreakdown: zod_1.z.array(zod_1.z.object({
        questionText: zod_1.z.string(),
        candidateResponseSummary: zod_1.z.string(),
        score: zod_1.z.number().min(1).max(10),
        keyTakeaway: zod_1.z.string(),
    })),
    redFlags: zod_1.z
        .array(zod_1.z.string())
        .describe("Critical errors, dishonest answers, or failing sandbox executions."),
    recommendedFollowUps: zod_1.z
        .array(zod_1.z.string())
        .describe("Topics for human interviewers to probe in the next round."),
});
