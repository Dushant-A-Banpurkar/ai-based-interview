


interface createInterviewSession{
    candidateId:string,
    roleTitle:string,
    jobDescription:string,
    difficultyMode:"beginner" | "medium" | "hard" | "extreme",
    enableSandbox:boolean,
    allowedLanguages:string[],
    targetSkills:string[],
    resumeText:File
}

const createInterviewSession=async(data:createInterviewSession)=>{
    const formData=new FormData();
    formData.append("resumeText",data.resumeText);
    formData.append("candidateId",data.candidateId);
    formData.append("roleTitle",data.roleTitle);
    formData.
}