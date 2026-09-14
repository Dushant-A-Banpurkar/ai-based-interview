import {z} from 'zod'


export const VoiceMetricsSchema=z.object({
    interviewId:z.string().min(1,"Interview ID is required"),
    rms:z.number(),
    spectralCentroid:z.number(),
    zcr:z.number(),
    timestamp:z.number()
});

export const CodeSubmissionSchema=z.object({
    interviewId:z.string().min(1,"Interview ID is required"),
    languageId:z.number(),
    sourceCode:z.string().min(1,"Source code cannot be empty")
});

export type VoiceMetrics=z.infer<typeof VoiceMetricsSchema>;
export type CodeSubmission=z.infer<typeof CodeSubmissionSchema>