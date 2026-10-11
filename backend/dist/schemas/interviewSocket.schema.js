"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeSubmissionSchema = exports.VoiceMetricsSchema = void 0;
const zod_1 = require("zod");
exports.VoiceMetricsSchema = zod_1.z.object({
    interviewId: zod_1.z.string().min(1, "Interview ID is required"),
    rms: zod_1.z.number(),
    spectralCentroid: zod_1.z.number(),
    zcr: zod_1.z.number(),
    timestamp: zod_1.z.number()
});
exports.CodeSubmissionSchema = zod_1.z.object({
    interviewId: zod_1.z.string().min(1, "Interview ID is required"),
    languageId: zod_1.z.number(),
    sourceCode: zod_1.z.string().min(1, "Source code cannot be empty")
});
