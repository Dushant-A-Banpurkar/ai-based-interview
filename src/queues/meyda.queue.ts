import {
  aggregateMeydaTelemetry,
  AggregatedAudioTelemetry,
  RawMeydaFrame,
} from "../utils/meydaAggregator";
import { generateCandidateReport } from "../services/reportGenerator.service";
import Redis from "ioredis";
import * as dotenv from "dotenv";

dotenv.config();

const redis = new Redis(process.env.REDIS_URL!);

export interface TranscriptItem {
  sender: "ai" | "candidate";
  text: string;
  timestamp: number;
}

export interface CodeSubmissionItem {
  language: string;
  code: string;
  sandboxResult: {
    stdout: string | null;
    stderr: string | null;
    status: { id: number; description: string };
  };
  timestamp: number;
}

async function getInterviewTranscript(
  interviewId: string,
): Promise<TranscriptItem[]> {
  const rawList = await redis.lrange(`interview:${interviewId}:code`, 0, -1);
  return rawList.map((item) => JSON.parse(item));
}

async function getCodeSubmissions(
  interviewId: string,
): Promise<CodeSubmissionItem[]> {
  const rawList = await redis.lrange(`interview:${interviewId}:code`, 0, -1);
  return rawList.map((item) => JSON.parse(item));
}
export async function processInterviewJob(inteviewId: string) {
  const rawTelementry = await redis.lrange(
    `inteview:${inteviewId}:telementry`,
    0,
    -1,
  );
  const frames: RawMeydaFrame[] = rawTelementry.map((item) => JSON.parse(item));

  const aggregateTelemetry :AggregatedAudioTelemetry|null=aggregateMeydaTelemetry(frames);

  const transcript = await getInterviewTranscript(inteviewId);
  const codeSubmissions = await getCodeSubmissions(inteviewId);
  const reportPayload = {
    transcript,
    codeSubmissions,
    audioTelemetryAverage: aggregateTelemetry,
  };
  const report = await generateCandidateReport(reportPayload);
  await redis.del(
    `interview:${inteviewId}:telementry`,
    `interview:${inteviewId}:transcript`,
    `interview:${inteviewId}:code`,
  );
  return report;
}
