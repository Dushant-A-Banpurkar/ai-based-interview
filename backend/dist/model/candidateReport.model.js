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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandidateReportModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CandidateReportSchema = new mongoose_1.Schema({
    interviewId: {
        type: String,
        required: true,
        index: true,
    },
    executiveSummary: {
        type: String,
        required: true,
        trim: true,
    },
    overallScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
    },
    recommendation: {
        type: String,
        enum: {
            values: ["Strong Hire", "Hire", "No Hire", "Strong Reject"],
            message: "{VALUE} is not a valid recommendation option",
        },
        required: true,
        trim: true,
    },
    technicalEvaluation: {
        type: {
            score: { type: Number, min: 1, max: 100 },
            problemSolvingScore: { type: Number, min: 1, max: 10 },
            codeQualityScore: { type: Number, min: 1, max: 10 },
            correctnessScore: { type: Number, min: 1, max: 10 },
            codeAnalysis: { type: String, trim: true },
            strengths: [String],
            improvements: [String],
        },
        default: undefined,
        required: true,
    },
    communicationEvaluation: {
        type: {
            score: { type: Number, min: 1, max: 10 },
            clarityAndStructure: { type: String, trim: true },
            deliveryAndConfidence: { type: String, trim: true },
            fillerWordsObserved: [String],
        },
        default: undefined,
    },
    questionBreakdown: [
        {
            questionText: { type: String, required: true },
            candidateResponseSummary: { type: String, required: true },
            score: { type: Number, min: 1, max: 10, required: true },
            keyTakeaway: { type: String, required: true },
        },
    ],
    redFlags: {
        type: [String],
        default: undefined,
    },
    recommendedFollowUps: {
        type: [String],
        default: undefined,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.CandidateReportModel = mongoose_1.default.models.CandiateReport ||
    mongoose_1.default.model("CandidateReport", CandidateReportSchema);
