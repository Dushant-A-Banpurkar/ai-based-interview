import { Queue, Worker } from "bullmq";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import Redis from "ioredis";
import * as dotenv from "dotenv";
dotenv.config();
const connection = new Redis(process.env.REDIS_URL!, {
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  maxRetriesPerRequest: null, // Required if using BullMQ or state workers
  enableReadyCheck: false,
});
export const interviewReportQueue = new Queue("interview-process", {
  connection,
});

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!, 
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

new Worker(
  "interview-processing",
  async (job) => {
    const { interviewId, candidateId, rawAudioBuffer } = job.data;

    const r2Key = `recording/${candidateId}/${interviewId}.wav`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: r2Key,
        Body: Buffer.from(rawAudioBuffer, "base64"),
        ContentType: "audio/wav",
      }),
    );
  },
  { connection },
);
