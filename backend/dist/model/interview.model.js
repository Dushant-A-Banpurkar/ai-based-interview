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
exports.CodeSubmissionModel = exports.voiceMetricsModel = exports.InterviewModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InterviewSchema = new mongoose_1.Schema({
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
        default: "scheduled",
        index: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.InterviewModel = mongoose_1.default.models.Interview ||
    mongoose_1.default.model("Interview", InterviewSchema);
const VoiceMetricsSchema = new mongoose_1.Schema({
    interviewId: {
        type: String,
        required: true,
        index: true,
    },
    rms: { type: Number },
    spectralCentroid: { type: Number },
    zcr: { type: Number },
    timestamp: { type: Number },
}, {
    timestamps: true,
    versionKey: false,
});
exports.voiceMetricsModel = mongoose_1.default.models.VoiceMetrics ||
    mongoose_1.default.model("VoiceMetrics", VoiceMetricsSchema);
const CodeSubmissionSchema = new mongoose_1.Schema({
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
}, {
    timestamps: true,
    versionKey: false,
});
exports.CodeSubmissionModel = mongoose_1.default.models.CodeSubmission ||
    mongoose_1.default.model("CodeSubmission", CodeSubmissionSchema);
