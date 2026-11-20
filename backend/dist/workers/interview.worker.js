"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviewWorker = exports.gemini = void 0;
exports.processInterviewJob = processInterviewJob;
const dotenv = __importStar(require("dotenv"));
const ioredis_1 = __importDefault(require("ioredis"));
const openai_1 = __importDefault(require("openai"));
const candidateReport_model_1 = require("../model/candidateReport.model");
const interview_model_1 = require("../model/interview.model");
const bullmq_1 = require("bullmq");
dotenv.config();
const redisClient = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
const bullmqRedisClient = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
const openai = process.env.OPENAI_API_KEY
    ? new openai_1.default({ apiKey: process.env.OPENAI_API_KEY })
    : null;
exports.gemini = process.env.GEMINI_API_KEY
    ? new openai_1.default({
        baseURL: process.env.GEMINI_BASE_URL ||
            "https://generativelanguage.googleapis.com/v1beta/openai/",
        apiKey: process.env.GEMINI_API_KEY,
    })
    : null;
function buildFallbackReport(interviewId, transcript, codeSubmissions, audioTelemetrySummary) {
    const solvedCount = codeSubmissions.filter((submission) => submission.submissionStatus === "solved").length;
    const attemptedCount = codeSubmissions.filter((submission) => submission.submissionStatus === "attempted").length;
    const totalQuestions = transcript.length;
    const baseScore = Math.min(100, Math.max(40, 55 + solvedCount * 15 + Math.min(attemptedCount, 3) * 5));
    return {
        interviewId,
        overallScore: baseScore,
        recommendation: solvedCount > 0 ? "Hire" : "No Hire",
        executiveSummary: `The candidate completed ${totalQuestions} recorded interview interactions with ${solvedCount} verified solved submission(s). ` +
            "This fallback evaluation was generated because the configured AI provider was unavailable, so the score is based on interview activity and submission outcomes.",
        technicalEvaluation: {
            score: Math.min(100, Math.max(40, baseScore - 5)),
            codeAnalysis: "Submission progress indicates the candidate engaged with the coding tasks and achieved a measurable level of solution completion. Full qualitative assessment was not available because no LLM provider was configured for report synthesis.",
            strengths: [
                "Attempted the assigned interview tasks.",
                solvedCount > 0
                    ? "Produced at least one completed solution path."
                    : "Demonstrated measurable engagement with the exercise.",
            ],
            improvements: [
                "Request a connected AI provider for a richer evaluation.",
                "Review code correctness and edge-case handling in more depth.",
            ],
        },
        communicationEvaluation: {
            score: Math.min(10, Math.max(4, Math.round((audioTelemetrySummary.averageRms || 0) * 10))),
            clarityAndStructure: "Candidate transcript activity was recorded, but no detailed language assessment could be produced without a provider-backed analysis.",
            deliveryAndConfidence: `Audio telemetry summary: RMS ${audioTelemetrySummary.averageRms ?? 0}, spectral centroid ${audioTelemetrySummary.averageSpectralCentroid ?? 0}, ZCR ${audioTelemetrySummary.averageZcr ?? 0}.`,
        },
        redFlags: [
            "Fallback report mode was used because no AI provider was configured.",
        ],
        questionBreakdown: transcript.length > 0
            ? transcript.slice(0, 5).map((item, index) => ({
                questionText: item?.question ?? `Question ${index + 1}`,
                score: Math.min(10, Math.max(4, 7 + (solvedCount > 0 ? 1 : 0))),
                candidateResponseSummary: item?.response ?? "No transcript response was captured for this question.",
                keyTakeaway: "Interview response was logged and included in the fallback evaluation.",
            }))
            : [
                {
                    questionText: "Interview session recorded",
                    score: 6,
                    candidateResponseSummary: "No interview transcripts were available at report time.",
                    keyTakeaway: "The interview record was preserved but no detailed question-by-question commentary was generated.",
                },
            ],
    };
}
function aggregateMeydaTelemetry(frames) {
    if (!frames.length) {
        return {
            averageRms: 0,
            averageSpectralCentroid: 0,
            averageZcr: 0,
            sampleCount: 0,
        };
    }
    const sums = frames.reduce((acc, f) => {
        acc.rms += f.rms || 0;
        acc.spectralCentroid += f.spectralCentroid || 0;
        acc.zcr += f.zcr || 0;
        return acc;
    }, { rms: 0, spectralCentroid: 0, zcr: 0 });
    const count = frames.length;
    return {
        averageRms: Number((sums.rms / count).toFixed(4)),
        averageSpectralCentroid: Number((sums.spectralCentroid / count).toFixed(4)),
        averageZcr: Number((sums.zcr / count).toFixed(4)),
        sampleCount: count,
    };
}
async function processInterviewJob(interviewId) {
    console.log(`[Worker] Starting report generation for interview: ${interviewId}`);
    const [rawTelemetry, rawTranscript, rawCode, durableSubmissions] = await Promise.all([
        redisClient.lrange(`interview:${interviewId}:telemetry`, 0, -1),
        redisClient.lrange(`interview:${interviewId}:transcript`, 0, -1),
        redisClient.lrange(`interview:${interviewId}:code`, 0, -1),
        interview_model_1.CodeSubmissionModel.find({ interviewId }).sort({ createdAt: 1 }).lean(),
    ]);
    const frames = rawTelemetry.map((item) => JSON.parse(item));
    const transcript = rawTranscript.map((t) => JSON.parse(t));
    const codeSubmissions = [
        ...rawCode.map((c) => JSON.parse(c)),
        ...durableSubmissions.map((submission) => ({
            problemId: submission.problemId,
            problemPrompt: submission.problemPrompt,
            language: submission.language,
            languageId: submission.languageId,
            code: submission.sourceCode,
            submissionStatus: submission.submissionStatus,
            executionStatus: submission.executionStatus,
            testSummary: submission.testSummary,
            timeSpentSeconds: submission.timeSpentSeconds,
            timestamp: submission.createdAt?.getTime() ?? 0,
        })),
    ];
    const audioTelemetrySummary = aggregateMeydaTelemetry(frames);
    const systemPrompt = `You are an expert technical hiring committee and principal engineer evaluator.`;
    const userPrompt = `
Evaluate this technical interview session:
- Acoustic Delivery Summary (Meyda RMS/Centroid/ZCR avg): ${JSON.stringify(audioTelemetrySummary)}
- Transcript History: ${JSON.stringify(transcript)}
- Final Code Submissions: ${JSON.stringify(codeSubmissions)}
- Outcomes are distinct: attempted, timed_out, and solved. Only a final "solved" outcome with all private tests passing is verified correct; an individual sandbox run is not proof of correctness.

Return a JSON object conforming strictly to this structure:
{
  "overallScore": number (0-100),
  "recommendation": "Strong Hire" | "Hire" | "No Hire" | "Strong Reject",
  "executiveSummary": string,
  "technicalEvaluation": {
    "score": number,
    "codeAnalysis": string,
    "strengths": string[],
    "improvements": string[]
  },
  "communicationEvaluation": {
    "score": number (0-10),
    "clarityAndStructure": string,
    "deliveryAndConfidence": string
  },
  "redFlags": string[],
  "questionBreakdown": [
    {
      "questionText": string,
      "score": number,
      "candidateResponseSummary": string,
      "keyTakeaway": string
    }
  ]
}
`;
    let parsedReport;
    if (!openai && !exports.gemini) {
        console.warn(`[Worker] No OpenAI or Gemini provider configured. Generating a fallback report for: ${interviewId}`);
        parsedReport = buildFallbackReport(interviewId, transcript, codeSubmissions, audioTelemetrySummary);
    }
    else {
        try {
            if (!openai)
                throw new Error("OPENAI_API_KEY is not configured.");
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                response_format: { type: "json_object" },
            });
            parsedReport = JSON.parse(completion.choices[0].message.content || "{}");
        }
        catch (openaiError) {
            console.warn(`[Worker] OpenAI failed (${openaiError.message}). Switching to Gemini for interview report...`);
            try {
                if (!exports.gemini) {
                    throw new Error("Report generation requires GEMINI_API_KEY when OpenAI is unavailable.", { cause: openaiError });
                }
                const completion = await exports.gemini.chat.completions.create({
                    model: "gemini-3.5-flash-lite",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                    temperature: 0.2,
                    response_format: { type: "json_object" },
                });
                parsedReport = JSON.parse(completion.choices[0].message.content || "{}");
            }
            catch (geminiError) {
                console.warn(`[Worker] Gemini failed (${geminiError.message}). Writing a fallback report instead...`);
                parsedReport = buildFallbackReport(interviewId, transcript, codeSubmissions, audioTelemetrySummary);
            }
        }
    }
    const normalizedReport = {
        overallScore: parsedReport?.overallScore ?? 50,
        recommendation: parsedReport?.recommendation ?? "No Hire",
        executiveSummary: parsedReport?.executiveSummary ?? "",
        technicalEvaluation: parsedReport?.technicalEvaluation ?? {
            score: 50,
            codeAnalysis: "No technical analysis was generated.",
            strengths: ["Interview activity was recorded."],
            improvements: ["Configure an AI provider for a richer summary."],
        },
        communicationEvaluation: parsedReport?.communicationEvaluation ?? {
            score: 5,
            clarityAndStructure: "No communication analysis was generated.",
            deliveryAndConfidence: "No delivery analysis was generated.",
        },
        redFlags: parsedReport?.redFlags ?? [],
        questionBreakdown: parsedReport?.questionBreakdown ?? [],
    };
    const savedReport = await candidateReport_model_1.CandidateReportModel.create({
        interviewId,
        overallScore: normalizedReport.overallScore,
        recommendation: normalizedReport.recommendation,
        executiveSummary: normalizedReport.executiveSummary,
        technicalEvaluation: normalizedReport.technicalEvaluation,
        communicationEvaluation: normalizedReport.communicationEvaluation,
        redFlags: normalizedReport.redFlags,
        questionBreakdown: normalizedReport.questionBreakdown,
    });
    await interview_model_1.InterviewModel.findByIdAndUpdate(interviewId, { status: "completed" });
    await redisClient.del(`interview:${interviewId}:telemetry`, `interview:${interviewId}:transcript`, `interview:${interviewId}:code`);
    console.log(`[Worker] Report generation finished for: ${interviewId}`);
    return savedReport;
}
exports.interviewWorker = new bullmq_1.Worker("interview-process", async (job) => {
    return await processInterviewJob(job.data.interviewId);
}, {
    connection: bullmqRedisClient,
    concurrency: 5,
});
exports.interviewWorker.on("completed", (job) => {
    console.log(`Job ${job?.id} completed successfully.`);
});
exports.interviewWorker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed with error:`, err);
});
