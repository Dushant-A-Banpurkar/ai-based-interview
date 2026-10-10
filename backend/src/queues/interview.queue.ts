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

const s3 = new S3Client({ region: process.env.AWS_REGION });

new Worker(
  "interview-processing",
  async (job) => {
    const { interviewId, candidateId, rawAudioBuffer } = job.data;

    const s3Key = `recording/${candidateId}/${interviewId}.wav`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_Bucket_NAME,
        Key: s3Key,
        Body: Buffer.from(rawAudioBuffer, "base64"),
        ContentType: "audio/wav",
      }),
    );
  },
  { connection },
);
