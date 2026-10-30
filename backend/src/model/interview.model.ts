import mongoose, { Schema, Document, Model } from "mongoose";
import type { StoredCodingAssignment } from "../types/codingAssignment";

export interface IInterview extends Document {
  candidateId: string;
  roleTitle: string;
  targetSkills: string[];
  resumeText: string;
  jobDescription: string;
  durationMinutes: 15 | 30 | 50;
  difficultyMode: "beginner" | "medium" | "hard" | "extreme";
  enableSandbox: boolean;
  allowedLanguages: string[];
  codingAssignment?: StoredCodingAssignment | null;
  codingStartedAt?: Date | null;
  codingDraft: string;
  codingLanguage: string;
  codingStatus: "not_started" | "active" | "completed";
  interviewStartedAt?: Date | null;
  status: "scheduled" | "live" | "processing" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

const InterviewSchema: Schema<IInterview> = new Schema(
  {
    candidateId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    roleTitle: {
      type: String,
      required: true,
      trim: true,
    },
    targetSkills: {
      type: [String],
      default: [],
    },
    resumeText: {
      type: String,
      default: "",
    },
    jobDescription: {
      type: String,
      required: true,
    },
    difficultyMode: {
      type: String,
      enum: ["beginner", "medium", "hard", "extreme"],
      default: "medium",
    },
    enableSandbox: {
      type: Boolean,
      default: true,
    },
    allowedLanguages: {
      type: [String],
      default: ["javascript", "python", "cpp"],
    },
    codingAssignment: {
      type: Schema.Types.Mixed,
      default: null,
    },
    codingStartedAt: {
      type: Date,
      default: null,
    },
    codingDraft: {
      type: String,
      default: "",
    },
    codingLanguage: {
      type: String,
      default: "javascript",
    },
    codingStatus: {
      type: String,
      enum: ["not_started", "active", "completed"],
      default: "not_started",
    },
    interviewStartedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["scheduled", "live", "processing", "completed"],
      default: "scheduled",
      index: true,
    },
    durationMinutes: {
      type: Number,
      enum: [15, 30, 50],
      required: true,
      default: 15,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const InterviewModel: Model<IInterview> =
  mongoose.models.Interview ||
  mongoose.model<IInterview>("Interview", InterviewSchema);

export interface IVoiceMetrics extends Document {
  interviewId: string;
  rms?: number;
  spectralCentroid?: number;
  zcr?: number;
  timestamp?: number;
}

const VoiceMetricsSchema: Schema<IVoiceMetrics> = new Schema(
  {
    interviewId: {
      type: String,
      required: true,
      index: true,
    },
    rms: { type: Number },
    spectralCentroid: { type: Number },
    zcr: { type: Number },
    timestamp: { type: Number },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const voiceMetricsModel: Model<IVoiceMetrics> =
  mongoose.models.VoiceMetrics ||
  mongoose.model<IVoiceMetrics>("VoiceMetrics", VoiceMetricsSchema);

export interface ICodeSubmission extends Document {
  interviewId: string;
  language?: string;
  languageId?: number;
  sourceCode?: string;
  problemId:string;
  problemPrompt:string;
  submissionStatus:"attempted"|"solved"|"timed_out";
  executionStatus?:string;
  timeSpentSeconds?:number;
  testSummary?: { passed: number; total: number };
  createdAt?: Date;
}

const CodeSubmissionSchema: Schema<ICodeSubmission> = new Schema(
  {
    interviewId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    problemId: {
      type: String,
      required: true,
    },
    problemPrompt: {
      type: String,
      required: true,
    },
    submissionStatus: {
      type: String,
      enum: ["attempted", "solved", "timed_out"],
      required: true,
    },
    language: {
      type: String,
      trim: true,
    },
    executionStatus: {
      type: String,
    },
    testSummary: {
      passed: { type: Number, min: 0 },
      total: { type: Number, min: 0 },
    },
    timeSpentSeconds: {
      type: Number,
    },
    languageId: {
      type: Number,
    },
    sourceCode: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

CodeSubmissionSchema.index({ interviewId: 1, problemId: 1 }, { unique: true });

export const CodeSubmissionModel: Model<ICodeSubmission> =
  mongoose.models.CodeSubmission ||
  mongoose.model<ICodeSubmission>("CodeSubmission", CodeSubmissionSchema);
