import {Request,Response} from "express"

export async function createInterviewSession(req:Request,res:Response):Promise<void> {
    const {candidate,roleTitle,targetSkills} =req.body;

    if(!candidate||!role)
}