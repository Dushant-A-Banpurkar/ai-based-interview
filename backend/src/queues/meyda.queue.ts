import {
  aggregateMeydaTelemetry,
  AggregatedAudioTelemetry,
  RawMeydaFrame,
} from "../utils/meydaAggregator";
import { generateCandidateReport } from "../services/reportGenerator.service";
import Redis from "ioredis";
import * as dotenv from "dotenv";
import { CandidateReportModel } from "../model/candidateReport.model";
import {
  CodeSubmissionModel,
  InterviewModel,
} from "../model/interview.model";

dotenv.config();

const redis = new Redis(process.env.REDIS_URL!);

export interface TranscriptItem {
  sender: "ai" | "candidate";
  text: string;
  timestamp: number;
}

export interface CodeSubmissionItem {
  language?: string;
  languageId?: number;
  code?: string;
  problemId?: string;
  problemPrompt?: string;
  submissionStatus?: "attempted" | "solved" | "timed_out";
  executionStatus?: string;
  testSummary?: { passed: number; total: number };
  timeSpentSeconds?: number;
  sandboxResult?: {
    stdout: string | null;
    stderr: string | null;
    status: { id: number; description: string };
  };
  timestamp?: number;
}

async function getInterviewTranscript(
  interviewId: string,
): Promise<TranscriptItem[]> {
  // FIXED: Now correctly reads from transcript key instead of code
  const rawList = await redis.lrange(`interview:${interviewId}:transcript`, 0, -1);
  return rawList.map((item) => JSON.parse(item));
}

async function getCodeSubmissions(
  interviewId: string,
): Promise<CodeSubmissionItem[]> {
  const [rawList, durableSubmissions] = await Promise.all([
    redis.lrange(`interview:${interviewId}:code`, 0, -1),
    CodeSubmissionModel.find({ interviewId }).sort({ createdAt: 1 }).lean(),
  ]);
  const executionHistory = rawList.map(
    (item) => JSON.parse(item) as CodeSubmissionItem,
  );
  const finalSubmissions: CodeSubmissionItem[] = durableSubmissions.map(
    (item) => ({
      problemId: item.problemId,
      problemPrompt: item.problemPrompt,
      language: item.language,
      languageId: item.languageId,
      code: item.sourceCode,
      submissionStatus: item.submissionStatus,
      executionStatus: item.executionStatus,
      testSummary: item.testSummary,
      timeSpentSeconds: item.timeSpentSeconds,
      timestamp: item.createdAt?.getTime() ?? 0,
    }),
  );
  return [...executionHistory, ...finalSubmissions];
}

export async function processInterviewJob(interviewId: string) {
  const rawTelemetry = await redis.lrange(
    `interview:${interviewId}:telemetry`,
    0,
    -1,
  );
  const frames: RawMeydaFrame[] = rawTelemetry.map((item) => JSON.parse(item));

  const aggregateTelemetry: AggregatedAudioTelemetry | null =
    aggregateMeydaTelemetry(frames);

  const transcript = await getInterviewTranscript(interviewId);
  const codeSubmissions = await getCodeSubmissions(interviewId);
  const reportPayload = {
    transcript,
    codeSubmissions,
    audioTelemetryAverage: aggregateTelemetry,
  };
  const reportData = await generateCandidateReport(reportPayload);

  await CandidateReportModel.create({
    interviewId,
    ...reportData,
  });

  await InterviewModel.findByIdAndUpdate(interviewId, { status: "completed" });
  await redis.del(
    `interview:${interviewId}:telemetry`,
    `interview:${interviewId}:transcript`,
    `interview:${interviewId}:code`,
  );
  return reportData;
}