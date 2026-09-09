import {Request,Response} from "express"
import { extractTextFromArrayBuffer } from "../helper/pdfToText";
import {InterviewModel} from '../model/interview.model';
import multer from "multer"

interface MulterRequest extends Request {
  file?: globalThis.Express.Multer.File;
}

export async function createInterviewSession(req:MulterRequest,res:Response):Promise<void> {
    try{
        const {
            candidateId,
            roleTitle,
            targetSkills,
            jobDescription,
            difficultyMode='medium',
            enableSandbox=true,
            allowedLanguages=['javascript','python','cpp']
        }=req.body;

        if(!candidateId||!roleTitle||!jobDescription){
            res.status(400).json({error:"candiateId, roleTitle, and jobDescription"});
            return;
        }

        let extractedResumeText='';
        if(req.file){
            const unitArrayData=new Uint8Array(req.file.buffer);
            // const arrayBuffer=buffer.buffer.slice(
            //     buffer.byteOffset,
            //     buffer.byteOffset+ buffer.byteLength
            // )

            const textData=await extractTextFromArrayBuffer(unitArrayData);

            if(!textData){
                console.warn("Warning: extractTextFromArrayBuffer returned empty or null data.")
            }
            else{
                extractedResumeText=textData;
            }
        }

        let parsedSkills: string[]=[];

        if(targetSkills){
            parsedSkills=typeof targetSkills==='string' ?JSON.parse(targetSkills) : targetSkills;
        }

        let parsedLanguages:string[]=allowedLanguages;
        if(typeof allowedLanguages==='string'){
            parsedLanguages=JSON.parse(allowedLanguages);
        }

        const interview=await InterviewModel.create({
            candidateId,
            roleTitle,
            targetSkills:parsedSkills,
            resumeText:extractedResumeText,
            jobDescription,
            difficultyMode,
            enableSandbox:String(enableSandbox)==='true',
            allowedLanguages:parsedLanguages,
            status:'scheduled'
        })

        res.status(201).json({
            message:'Interview session created successfully with uploaded resume.',
            interviewId:interview._id,
            config:{
                difficultyMode:interview.difficultyMode,
                enableSandbox:interview.enableSandbox,
                allowedLanguages:interview.allowedLanguages,
            }
        })

    }
    catch(error:any){
        console.error("Error in createInterviewSession: ",error.message);
        res.status(500).json({error:'Failed to create interview session',details:error.message})
    }
}