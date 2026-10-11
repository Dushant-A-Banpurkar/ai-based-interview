"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInterviewSession = createInterviewSession;
exports.endInterviewSession = endInterviewSession;
exports.getInterviewStatus = getInterviewStatus;
exports.getInterviewReport = getInterviewReport;
const pdfToText_1 = require("../helper/pdfToText");
const interview_model_1 = require("../model/interview.model");
const interview_schema_1 = require("../schemas/interview.schema");
const interview_queue_1 = require("../queues/interview.queue");
const zod_1 = require("zod");
const candidateReport_model_1 = require("../model/candidateReport.model");
async function createInterviewSession(req, res) {
    try {
        let parsedSkills = [];
        if (req.body.targetSkills) {
            parsedSkills =
                typeof req.body.targetSkills === "string"
                    ? JSON.parse(req.body.targetSkills)
                    : req.body.targetSkills;
        }
        let parsedLanguages = req.body.allowedLanguages;
        if (typeof req.body.allowedLanguages === "string") {
            parsedLanguages = JSON.parse(req.body.allowedLanguages);
        }
        const parsedEnableSandox = req.body.enableSandbox !== undefined
            ? String(req.body.enableSandbox) === "true"
            : true;
        const payloadToValidate = {
            ...req.body,
            targetSkills: parsedSkills,
            allowedLanguages: parsedLanguages,
            enableSandbox: parsedEnableSandox,
        };
        const validationResult = interview_schema_1.CreateInterviewSchema.safeParse(payloadToValidate);
        if (!validationResult.success) {
            res.status(400).json({
                error: "Validation failed",
                details: validationResult.error.format(),
            });
            return;
        }
        const { candidateId, roleTitle, jobDescription, difficultyMode = "medium", enableSandbox, allowedLanguages, targetSkills, } = validationResult.data;
        let extractedResumeText = "";
        if (req.file) {
            const unitArrayData = new Uint8Array(req.file.buffer);
            const textData = await (0, pdfToText_1.extractTextFromArrayBuffer)(unitArrayData);
            if (!textData) {
                console.warn("Warning: extractTextFromArrayBuffer returned empty or null data.");
            }
            else {
                extractedResumeText = textData;
            }
        }
        const interview = await interview_model_1.InterviewModel.create({
            candidateId,
            roleTitle,
            targetSkills: parsedSkills || [],
            resumeText: extractedResumeText,
            jobDescription,
            difficultyMode,
            enableSandbox,
            allowedLanguages,
            status: "scheduled",
        });
        res.status(201).json({
            message: "Interview session created successfully with uploaded resume.",
            interviewId: interview._id,
            config: {
                difficultyMode: interview.difficultyMode,
                enableSandbox: interview.enableSandbox,
                allowedLanguages: interview.allowedLanguages,
            },
        });
    }
    catch (error) {
        console.error("Error in createInterviewSession: ", error.message);
        res.status(500).json({
            error: "Failed to create interview session",
            details: error.message,
        });
    }
}
const InterviewIdSchema = zod_1.z.object({
    interviewId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, {
        message: "Invalid interviewId format. Must be a valid 24-character hex string.",
    }),
});
async function endInterviewSession(req, res) {
    try {
        const validationResult = InterviewIdSchema.safeParse(req.params);
        if (!validationResult.success) {
            res.status(400).json({
                error: "Validation failed",
                details: validationResult.error.format(),
            });
            return;
        }
        const { interviewId } = validationResult.data;
        const interview = await interview_model_1.InterviewModel.findById(interviewId);
        if (!interview) {
            res.status(404).json({ error: "Interview session not found" });
            return;
        }
        interview.status = "processing";
        await interview.save();
        await interview_queue_1.interviewReportQueue.add("generate-report", {
            interviewId: interview._id.toString(),
            candidateId: interview.candidateId,
        });
        res.status(200).json({
            message: "Interview ended. Post-interview processing queued.",
            interviewId: interview._id,
            status: "processing",
        });
    }
    catch (error) {
        console.error("Error in endInterviewSession: ", error.message);
        res.status(500).json({
            error: "Failed to end interview session",
            details: error.message,
        });
    }
}
async function getInterviewStatus(req, res) {
    try {
        const validationResult = InterviewIdSchema.safeParse(req.params);
        if (!validationResult.success) {
            res.status(400).json({
                error: "Validation failed",
                details: validationResult.error.format(),
            });
            return;
        }
        const { interviewId } = validationResult.data;
        const interview = await interview_model_1.InterviewModel.findById(interviewId, "status roleTitle createdAt");
        if (!interview) {
            res.status(404).json({ error: "Interview session not found." });
            return;
        }
        res.status(200).json({
            message: "Successfully fetch interview status",
            interviewId: interview._id,
            status: interview.status,
        });
    }
    catch (error) {
        console.error("Error in getInterviewStatus: ", error.message);
        res
            .status(500)
            .json({ error: "Failed to fetch status", details: error.message });
    }
}
async function getInterviewReport(req, res) {
    try {
        const validationResult = InterviewIdSchema.safeParse(req.params);
        if (!validationResult.success) {
            res.status(400).json({
                error: "Validation failed",
                details: validationResult.error.format(),
            });
            return;
        }
        const { interviewId } = validationResult.data;
        const report = await candidateReport_model_1.CandidateReportModel.findOne({ interviewId });
        if (!report) {
            res.status(404).json({
                error: "Report not found or processing is still in progress.",
            });
            return;
        }
        res.status(200).json({ report });
    }
    catch (error) {
        console.error("Error in getInterviewReport", error.message);
        res
            .status(500)
            .json({ error: "Failed to retrieve report", details: error.message });
    }
}
