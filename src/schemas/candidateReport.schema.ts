import {z} from 'zod';


export const CondidateReportSchema=z.object({
    executiveSummary:z.string().describe('A 2-3 sentence high-level overview of the candidate performance.'),
    overallScore:z.number().min(0).max(100).describe('Aggregate score from 0 to 100.'),
    recommendation:z.enum([
        'Strong Hire',
        'Hire',
        'Lean Hire',
        'Lean Reject',
        'Reject'
    ]),

    technicalEvaluation:z.object({
        score:z.number().min(1).max(10),
        problemSolvingScore:z.number().min(1).max(10),
        codeQualtiyScore:z.number().min(1).max(10),
        correctnessScore:z.number().min(1).max(10),
        codeAnalysis:z.string().describe('Detailed evalutation of source code efficinecy, edge cases, and sandbox text results.'),
        strengths:z.array(z.string()),
        improvements:z.array(z.string())
    }),

    communicationEvaluation:z.object({
        score:z.number()
    })
})
