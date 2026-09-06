import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVoiceMetrics extends Document {
  interviewId:string; 
  rms?: number;
  spectralCentroid?: number;
  zcr?: number;
  timestamp?: number;
}

const VoiceMetricsSchema: Schema<IVoiceMetrics> = new Schema(
  {
    interviewId:{
      type:String,
      required:true,
      index:true
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
      index:true,
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
