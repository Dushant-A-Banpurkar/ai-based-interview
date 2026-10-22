"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeSubmissionSchema = exports.VoiceMetricsSchema = void 0;
const zod_1 = require("zod");
exports.VoiceMetricsSchema = zod_1.z.object({
    interviewId: zod_1.z.string().min(1, "Interview ID is required"),
    rms: zod_1.z.number().nullable().transform((val) => val ?? 0),
    spectralCentroid: zod_1.z.number().nullable().transform((val) => val ?? 0),
    zcr: zod_1.z.number().nullable().transform((val) => val ?? 0),
    timestamp: zod_1.z.number(),
});
exports.CodeSubmissionSchema = zod_1.z.object({
    interviewId: zod_1.z.string().min(1, "Interview ID is required"),
    languageId: zod_1.z.number(),
    sourceCode: zod_1.z.string().min(1, "Source code cannot be empty"),
    problemId: zod_1.z.string().min(1, "Problem Id is required"),
    problemPrompt: zod_1.z.string().min(1, "Problem Prompt is required"),
    submissionStatus: zod_1.z.enum(["attempted", "solved", "timed_out"])
});
