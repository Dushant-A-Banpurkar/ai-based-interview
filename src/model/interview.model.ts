import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInterview extends Document {
  candidateId: string;
  roleTitle: string;
  targetSkills: string[];
  resumeText: string;
  jobDescription: string;
  difficultyMode: "beginner" | "medium" | "hard" | "extreme";
  enableSandbox: boolean;
  allowedLanguages: string[];
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
    status: {
      type: String,
      enum: ["scheduled", "live", "processing", "completed"],
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const InterviewModel:Model<IInterview>=mongoose.models.Interview || mongoose.model<IInterview>("Interview",InterviewSchema)

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

export const voiceMertricsModel: Model<IVoiceMetrics> =
  mongoose.models.VoiceMetrics ||
  mongoose.model<IVoiceMetrics>("VoiceMetrics", VoiceMetricsSchema);

export interface ICodeSubmission extends Document {
  interviewId: string;
  languageId?: number;
  sourceCode?: string;
}

const CodeSubmissionSchema: Schema<ICodeSubmission> = new Schema(
  {
    interviewId: {
      type: String,
      required: true,
      trim: true,
      index: true,
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

export const CodeSubmissionModel: Model<ICodeSubmission> =
  mongoose.models.CodeSubmission ||
  mongoose.model<ICodeSubmission>("CodeSubmission", CodeSubmissionSchema);
