import { Request, Response } from "express";
import { extractTextFromArrayBuffer } from "../helper/pdfToText";
import { InterviewModel } from "../model/interview.model";
import { CreateInterviewSchema } from "../schemas/interview.schema";

interface MulterRequest extends Request {
  file?: globalThis.Express.Multer.File;
}

export async function createInterviewSession(
  req: MulterRequest,
  res: Response,
): Promise<void> {
  try {
    let parsedSkills: string[] = [];

    if (req.body.targetSkills) {
      parsedSkills =
        typeof req.body.targetSkills === "string"
          ? JSON.parse(req.body.targetSkills)
          : req.body.targetSkills;
    }

    let parsedLanguages: string[] = req.body.allowedLanguages;
    if (typeof req.body.allowedLanguages === "string") {
      parsedLanguages = JSON.parse(req.body.allowedLanguages);
    }

    const parsedEnableSandox =
      req.body.enableSandbox !== undefined
        ? String(req.body.enableSandbox) === "true"
        : true;

    const payloadToValidate = {
      ...req.body,
      targetSkills: parsedSkills,
      allowedLanguages: parsedLanguages,
      enableSandbox: parsedEnableSandox,
    };

    const validationResult = CreateInterviewSchema.safeParse(payloadToValidate);
    if (!validationResult.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.format(),
      });
      return;
    }

    const {
      candidateId,
      roleTitle,
      jobDescription,
      difficultyMode = "medium",
      enableSandbox,
      allowedLanguages,
      targetSkills,
    } = validationResult.data;

    let extractedResumeText = "";
    if (req.file) {
      const unitArrayData = new Uint8Array(req.file.buffer);
      const textData = await extractTextFromArrayBuffer(unitArrayData);

      if (!textData) {
        console.warn(
          "Warning: extractTextFromArrayBuffer returned empty or null data.",
        );
      } else {
        extractedResumeText = textData;
      }
    }
    const interview = await InterviewModel.create({
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
  } catch (error: any) {
    console.error("Error in createInterviewSession: ", error.message);
    res.status(500).json({
      error: "Failed to create interview session",
      details: error.message,
    });
  };
};
