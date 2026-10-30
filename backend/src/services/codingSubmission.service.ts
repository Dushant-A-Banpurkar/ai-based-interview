import { CodeSubmissionModel, InterviewModel } from "../model/interview.model";
import {
  normalizeCodingLanguage,
  verifyCodingAssignment,
} from "./codingAssignment.service";

const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  python: 71,
  cpp: 54,
};

export type CodingFinishReason =
  | "submitted"
  | "timed_out"
  | "disconnected"
  | "interview_ended";

export async function finalizeCodingSubmission(
  interviewId: string,
  reason: CodingFinishReason,
  finalCode?: string,
  finalLanguage?: string,
) {
  const interview = await InterviewModel.findById(interviewId);
  if (
    !interview?.codingAssignment ||
    !interview.codingStartedAt ||
    interview.codingStatus !== "active"
  ) {
    return null;
  }

  const language = normalizeCodingLanguage(
    finalLanguage ?? interview.codingLanguage ?? "javascript",
  );
  const languageId = LANGUAGE_IDS[language];
  if (
    !languageId ||
    !interview.allowedLanguages.some(
      (allowed) => normalizeCodingLanguage(allowed) === language,
    )
  ) {
    throw new Error(`Unsupported coding language: ${language}`);
  }

  const code = finalCode ?? interview.codingDraft ?? "";
  const timeSpentSeconds = Math.max(
    0,
    Math.floor((Date.now() - interview.codingStartedAt.getTime()) / 1000),
  );
  let submissionStatus: "attempted" | "solved" | "timed_out" = "attempted";
  let executionStatus = "Not verified";
  let testSummary: { passed: number; total: number } | undefined;

  if (reason === "timed_out") {
    submissionStatus = "timed_out";
  } else {
    try {
      const verification = await verifyCodingAssignment(
        interview.codingAssignment,
        code,
        languageId,
      );
      executionStatus = verification.executionStatus;
      testSummary = {
        passed: verification.passed,
        total: verification.total,
      };
      if (verification.solved) submissionStatus = "solved";
    } catch (error) {
      executionStatus = "Verification unavailable";
      console.error(
        `Assignment verification failed for interview ${interviewId}:`,
        error,
      );
    }
  }

  let submission;
  try {
    submission = await CodeSubmissionModel.create({
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
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      submission = await CodeSubmissionModel.findOne({
        interviewId,
        problemId: interview.codingAssignment.public.problemId,
      });
    } else {
      throw error;
    }
  }

  if (!submission) {
    throw new Error("Coding submission could not be persisted.");
  }

  const finalized = await InterviewModel.updateOne(
    { _id: interviewId, codingStatus: "active" },
    { $set: { codingStatus: "completed" } },
  );
  if (finalized.modifiedCount !== 1) return null;
  return submission;
}
