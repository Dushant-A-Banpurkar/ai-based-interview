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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processInterviewJob = processInterviewJob;
const meydaAggregator_1 = require("../utils/meydaAggregator");
const reportGenerator_service_1 = require("../services/reportGenerator.service");
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv = __importStar(require("dotenv"));
const candidateReport_model_1 = require("../model/candidateReport.model");
const interview_model_1 = require("../model/interview.model");
dotenv.config();
const redis = new ioredis_1.default(process.env.REDIS_URL);
async function getInterviewTranscript(interviewId) {
    // FIXED: Now correctly reads from transcript key instead of code
    const rawList = await redis.lrange(`interview:${interviewId}:transcript`, 0, -1);
    return rawList.map((item) => JSON.parse(item));
}
async function getCodeSubmissions(interviewId) {
    // FIXED: Now correctly reads from code key instead of transcript
    const rawList = await redis.lrange(`interview:${interviewId}:code`, 0, -1);
    return rawList.map((item) => JSON.parse(item));
}
async function processInterviewJob(interviewId) {
    const rawTelemetry = await redis.lrange(`interview:${interviewId}:telemetry`, 0, -1);
    const frames = rawTelemetry.map((item) => JSON.parse(item));
    const aggregateTelemetry = (0, meydaAggregator_1.aggregateMeydaTelemetry)(frames);
    const transcript = await getInterviewTranscript(interviewId);
    const codeSubmissions = await getCodeSubmissions(interviewId);
    const reportPayload = {
        transcript,
        codeSubmissions,
        audioTelemetryAverage: aggregateTelemetry,
    };
    const reportData = await (0, reportGenerator_service_1.generateCandidateReport)(reportPayload);
    await candidateReport_model_1.CandidateReportModel.create({
        interviewId,
        ...reportData,
    });
    await interview_model_1.InterviewModel.findByIdAndUpdate(interviewId, { status: "completed" });
    await redis.del(`interview:${interviewId}:telemetry`, `interview:${interviewId}:transcript`, `interview:${interviewId}:code`);
    return reportData;
}
