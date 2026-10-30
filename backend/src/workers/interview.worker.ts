import * as dotenv from "dotenv";
import Redis from "ioredis";
import OpenAI from "openai";
import { CandidateReportModel } from "../model/candidateReport.model";
import {
  CodeSubmissionModel,
  InterviewModel,
} from "../model/interview.model";
import { Job, Worker } from "bullmq";

dotenv.config();

const redisClient = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});
const bullmqRedisClient = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const gemini = process.env.GEMINI_API_KEY
  ? new OpenAI({
      baseURL:
        process.env.GEMINI_BASE_URL ||
        "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: process.env.GEMINI_API_KEY,
    })
  : null;

interface RawMeydaFrame {
  rms: number;
  spectralCentroid: number;
  zcr: number;
  timestamp: number;
}

function aggregateMeydaTelemetry(frames: RawMeydaFrame[]) {
  if (!frames.length) {
    return {
      averageRms: 0,
      averageSpectralCentroid: 0,
      averageZcr: 0,
      sampleCount: 0,
    };
  }

  const sums = frames.reduce(
    (acc, f) => {
      acc.rms += f.rms || 0;
      acc.spectralCentroid += f.spectralCentroid || 0;
      acc.zcr += f.zcr || 0;
      return acc;
    },
    { rms: 0, spectralCentroid: 0, zcr: 0 },
  );

  const count = frames.length;
  return {
    averageRms: Number((sums.rms / count).toFixed(4)),
    averageSpectralCentroid: Number((sums.spectralCentroid / count).toFixed(4)),
    averageZcr: Number((sums.zcr / count).toFixed(4)),
    sampleCount: count,
  };
}

export async function processInterviewJob(interviewId: string) {
  console.log(
    `[Worker] Starting report generation for interview: ${interviewId}`,
  );

  const [rawTelemetry, rawTranscript, rawCode, durableSubmissions] =
    await Promise.all([
      redisClient.lrange(`interview:${interviewId}:telemetry`, 0, -1),
      redisClient.lrange(`interview:${interviewId}:transcript`, 0, -1),
      redisClient.lrange(`interview:${interviewId}:code`, 0, -1),
      CodeSubmissionModel.find({ interviewId }).sort({ createdAt: 1 }).lean(),
    ]);

  const frames: RawMeydaFrame[] = rawTelemetry.map((item) => JSON.parse(item));
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

  try {
    if (!openai) throw new Error("OPENAI_API_KEY is not configured.");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    parsedReport = JSON.parse(completion.choices[0].message.content || "{}");
  } catch (openaiError: any) {
    console.warn(
      `[Worker] OpenAI failed (${openaiError.message}). Switching to Gemini for interview report...`,
    );
    if (!gemini) {
      throw new Error(
        "Report generation requires GEMINI_API_KEY when OpenAI is unavailable.",
        { cause: openaiError },
      );
    }
    const completion = await gemini.chat.completions.create({
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

  const savedReport = await CandidateReportModel.create({
    interviewId,
    overallScore: parsedReport.overallScore ?? 50,
    recommendation: parsedReport.recommendation ?? "No Hire",
    executiveSummary: parsedReport.executiveSummary ?? "",
    technicalEvaluation: parsedReport.technicalEvaluation,
    communicationEvaluation: parsedReport.communicationEvaluation,
    redFlags: parsedReport.redFlags ?? [],
    questionBreakdown: parsedReport.questionBreakdown ?? [],
  });

  await InterviewModel.findByIdAndUpdate(interviewId, { status: "completed" });
  await redisClient.del(
    `interview:${interviewId}:telemetry`,
    `interview:${interviewId}:transcript`,
    `interview:${interviewId}:code`,
  );
  console.log(`[Worker] Report generation finished for: ${interviewId}`);
  return savedReport;
}

export const interviewWorker = new Worker(
  "interview-process",
  async (job: Job<{ interviewId: string }>) => {
    return await processInterviewJob(job.data.interviewId);
  },
  {
    connection: bullmqRedisClient,
    concurrency: 5,
  },
);

interviewWorker.on("completed", (job: any) => {
  console.log(`Job ${job?.id} completed successfully.`);
});

interviewWorker.on("failed", (job: any, err: any) => {
  console.error(`Job ${job?.id} failed with error:`, err);
});
