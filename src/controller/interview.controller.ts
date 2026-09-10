import { Request, Response } from "express";
import { extractTextFromArrayBuffer } from "../helper/pdfToText";
import { InterviewModel } from "../model/interview.model";
import { CreateInterviewSchema } from "../schemas/interview.schema";
import { interviewReportQueue } from "../queues/interview.queue";
import {z} from 'zod';
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

const InterviewIdSchema = z.object({
  interviewId: z.string().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid interviewId format. Must be a valid 24-character hex string."
  })
});

export async function endInterviewSession(req: Request, res: Response) {
  try {

    const validationResult=InterviewIdSchema.safeParse(req.body);
    if(!validationResult.success){
        res.status(400).json({
            error:'Validation failed',
            details:validationResult.error.format()
        });
        return;
    }
    const { interviewId }=validationResult.data;

    const interview=await InterviewModel.findById(interviewId);
    if(!interview){
        res.status(404).json({error:'Interview session not found'});
        return;
    }

    interview.status='processing';
    await interview.save();

    await interviewReportQueue.add('generate-report',{
        interviewId:interview._id.toString(),
        candiateId:interview.candidateId
    });

    res.status(200).json({
        message:'Interview ended. Post-interview processing queued.',
        interviewId:interview._id,
        status:'processing',
    })
  } catch (error: any) {
    console.error("Error in endInterviewSession: ",error.message);
    res.status(500).json({
      error: "Failed to end interview session",
      details: error.message,
    });
  }
}

export async function getInterviewStatus(req:Request,res:Response):Promise<void>{
  try{
    const validationResult=InterviewIdSchema.safeParse(req.params);
    if(!validationResult.success){
        res.status(400).json({
            error:'Validation failed',
            details:validationResult.error.format()
        });
        return;
    }
    const {interviewId}=validationResult.data;

    const interview=await InterviewModel.findById(interviewId,'status roleTitle createdAt');
    if(!interview){
      res.status(404).json({error:'Interview session not found.'});
      return;
    }

    res.status(200).json({
      message:"Successfully fetch interview status",
      interviewId:interview._id,
      status:interview.status,
    })
  }
  catch(error:any){
    console.error("Error in getInterviewStatus: ",error.message);
    res.status(500).json({error:'Failed to fetch status',details:error.message})
  }
}