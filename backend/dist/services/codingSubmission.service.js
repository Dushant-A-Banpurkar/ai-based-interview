"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalizeCodingSubmission = finalizeCodingSubmission;
const interview_model_1 = require("../model/interview.model");
const codingAssignment_service_1 = require("./codingAssignment.service");
const LANGUAGE_IDS = {
    javascript: 63,
    python: 71,
    cpp: 54,
};
async function finalizeCodingSubmission(interviewId, reason, finalCode, finalLanguage) {
    const interview = await interview_model_1.InterviewModel.findById(interviewId);
    if (!interview?.codingAssignment ||
        !interview.codingStartedAt ||
        interview.codingStatus !== "active") {
        return null;
    }
    const language = (0, codingAssignment_service_1.normalizeCodingLanguage)(finalLanguage ?? interview.codingLanguage ?? "javascript");
    const languageId = LANGUAGE_IDS[language];
    if (!languageId ||
        !interview.allowedLanguages.some((allowed) => (0, codingAssignment_service_1.normalizeCodingLanguage)(allowed) === language)) {
        throw new Error(`Unsupported coding language: ${language}`);
    }
    const code = finalCode ?? interview.codingDraft ?? "";
    const timeSpentSeconds = Math.max(0, Math.floor((Date.now() - interview.codingStartedAt.getTime()) / 1000));
    let submissionStatus = "attempted";
    let executionStatus = "Not verified";
    let testSummary;
    if (reason === "timed_out") {
        submissionStatus = "timed_out";
    }
    else {
        try {
            const verification = await (0, codingAssignment_service_1.verifyCodingAssignment)(interview.codingAssignment, code, languageId);
            executionStatus = verification.executionStatus;
            testSummary = {
                passed: verification.passed,
                total: verification.total,
            };
            if (verification.solved)
                submissionStatus = "solved";
        }
        catch (error) {
            executionStatus = "Verification unavailable";
            console.error(`Assignment verification failed for interview ${interviewId}:`, error);
        }
    }
    let submission;
    try {
        submission = await interview_model_1.CodeSubmissionModel.create({
            interviewId,
            language,
            languageId,
            sourceCode: code,
            problemId: interview.codingAssignment.public.problemId,
            problemPrompt: interview.codingAssignment.public.statement,
            submissionStatus,
            executionStatus,
            testSummary,
            timeSpentSeconds,
        });
    }
    catch (error) {
        if (typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11000) {
            submission = await interview_model_1.CodeSubmissionModel.findOne({
                interviewId,
                problemId: interview.codingAssignment.public.problemId,
            });
        }
        else {
            throw error;
        }
    }
    if (!submission) {
        throw new Error("Coding submission could not be persisted.");
    }
    const finalized = await interview_model_1.InterviewModel.updateOne({ _id: interviewId, codingStatus: "active" }, { $set: { codingStatus: "completed" } });
    if (finalized.modifiedCount !== 1)
        return null;
    return submission;
}
