import * as dotenv from "dotenv";
import Redis from "ioredis";
import OpenAI from "openai";
import { CandidateReportModel } from "../model/candidateReport.model";
import { Job, Worker } from "bullmq";

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  const [rawTelemetry, rawTranscript, rawCode] = await Promise.all([
    redis.lrange(`interview:${interviewId}:telemetry`, 0, -1),
    redis.lrange(`interview:${interviewId}:transcript`, 0, -1),
    redis.lrange(`interview:${interviewId}:code`, 0, -1),
  ]);

  const frames: RawMeydaFrame[] = rawTelemetry.map((item) => JSON.parse(item));
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

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const parsedReport = JSON.parse(
    completion.choices[0].message.content || "{}",
  );

  const savedReport = await CandidateReportModel.create({
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

export const interviewWorker = new Worker(
  "interview-processing-queue",
  async (job: Job<{ interviewId: string }>) => {
    return await processInterviewJob(job.data.interviewId);
  },
  {
    connection: redis,
    concurrency: 5,
  },
);

interviewWorker.on("completed", (job: any) => {
  console.log(`Job ${job?.id} completed successfully.`);
});

interviewWorker.on("failed", (job: any, err: any) => {
  console.error(`Job ${job?.id} failed with error:`, err);
});
