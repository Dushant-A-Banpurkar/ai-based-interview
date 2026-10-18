import { z } from "zod";

const durationMinutesSchema = z.preprocess(
  (value) => (value === undefined ? 15 : Number(value)),
  z.union([z.literal(15), z.literal(30), z.literal(50)]),
);

export const CreateInterviewSchema = z.object({
  candidateId: z.string().min(1, "Candidate ID is required"),
  roleTitle: z.string().min(1, "Role title is required"),
  targetSkills: z.array(z.string()).default([]),
  resumeText: z.string().optional().default(""),
  jobDescription: z.string().min(1, "Job description is required"),
  difficultyMode: z
    .enum(["beginner", "medium", "hard", "extreme"])
    .default("medium"),
  durationMinutes: durationMinutesSchema,
  enableSandbox: z.boolean().default(true),
  allowedLanguages: z
    .array(z.string())
    .default(["javascript", "python", "cpp"]),
});

export type CreateInterviewInput = z.infer<typeof CreateInterviewSchema>;
