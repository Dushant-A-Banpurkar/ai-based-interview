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
const bullmq_1 = require("bullmq");
dotenv.config();
const redisClient = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
const bullmqRedisClient = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
exports.gemini = new openai_1.default({
    baseURL: process.env.GEMINI_BASE_URL,
    apiKey: process.env.GEMINI_API_KEY,
});
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
    const [rawTelemetry, rawTranscript, rawCode] = await Promise.all([
        redisClient.lrange(`interview:${interviewId}:telemetry`, 0, -1),
        redisClient.lrange(`interview:${interviewId}:transcript`, 0, -1),
        redisClient.lrange(`interview:${interviewId}:code`, 0, -1),
    ]);
    const frames = rawTelemetry.map((item) => JSON.parse(item));
    const transcript = rawTranscript.map((t) => JSON.parse(t));
    const codeSubmissions = rawCode.map((c) => JSON.parse(c));
    const audioTelemetrySummary = aggregateMeydaTelemetry(frames);
    const systemPrompt = `You are an expert technical hiring committee and principal engineer evaluator.`;
    const userPrompt = `
Evaluate this technical interview session:
- Acoustic Delivery Summary (Meyda RMS/Centroid/ZCR avg): ${JSON.stringify(audioTelemetrySummary)}
- Transcript History: ${JSON.stringify(transcript)}
- Final Code Submissions: ${JSON.stringify(codeSubmissions)}

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
    try {
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
    const savedReport = await candidateReport_model_1.CandidateReportModel.create({
        interviewId,
        overallScore: parsedReport.overallScore ?? 50,
        recommendation: parsedReport.recommendation ?? "Reject",
        executiveSummary: parsedReport.executiveSummary ?? "",
        technicalEvaluation: parsedReport.teachnicalEvaluation,
        communicationEvaluation: parsedReport.communicationEvaluation,
        redFlags: parsedReport.redFlags ?? [],
        questionBreakdown: parsedReport.questionBreakdown ?? [],
    });
    console.log(`[Worker] Report generation finished for: ${interviewId}`);
    return savedReport;
}
exports.interviewWorker = new bullmq_1.Worker("interview-processing-queue", async (job) => {
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
