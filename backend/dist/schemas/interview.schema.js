"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateInterviewSchema = void 0;
const zod_1 = require("zod");
exports.CreateInterviewSchema = zod_1.z.object({
    candidateId: zod_1.z.string().min(1, "Candidate ID is required"),
    roleTitle: zod_1.z.string().min(1, "Role title is required"),
    targetSkills: zod_1.z.array(zod_1.z.string()).default([]),
    resumeText: zod_1.z.string().optional().default(""),
    jobDescription: zod_1.z.string().min(1, "Job description is required"),
    difficultyMode: zod_1.z.enum(["beginner", "medium", "hard", "extreme"]).default("medium"),
    enableSandbox: zod_1.z.boolean().default(true),
    allowedLanguages: zod_1.z.array(zod_1.z.string()).default(["javascript", "python", "cpp"])
});
