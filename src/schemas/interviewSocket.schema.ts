import {z} from 'zod'


export const VoiceMetricsSchema=z.object({
    rms:z.number(),
    spectralCentroid:z.number(),
    zcr:z.number(),
    timestamp:z.number()
});

export const CodeSubmissionSchema=z.object({
    interviewId:z.string().uuid(),
    languageId:z.number(),
    sourceCode:z.string().min(1)
});

export type VoiceMetrics=z.infer<typeof VoiceMetricsSchema>;
export type CodeSubmission=z.infer<typeof CodeSubmissionSchema>