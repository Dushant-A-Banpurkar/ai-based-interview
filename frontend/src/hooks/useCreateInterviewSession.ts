/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { setTargetSession } from "../store/slices/interviewSlice";
import { toast } from "sonner";
import { useAuthUser } from "./authMe";

interface CreateInterviewPayload {
  candidateId: string;
  roleTitle: string;
  jobDescription: string;
  difficultyMode?: "beginner" | "medium" | "hard" | "extreme";
  enableSandbox?: boolean;
  allowedLanguages: string[];
  targetSkills: string[];
  resumeText?: File | null;
}

const createInterviewSession = async (payload: CreateInterviewPayload) => {
  const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
  const formData = new FormData();
  formData.append("candidateId", payload.candidateId);
  formData.append("roleTitle", payload.roleTitle);
  formData.append("jobDescription", payload.jobDescription);
  if (payload.difficultyMode)
    formData.append("difficultyMode", payload.difficultyMode);
  formData.append("enableSandbox", String(payload.enableSandbox ?? true));
  formData.append("targetSkills", JSON.stringify(payload.targetSkills));
  formData.append(
    "allowedLanguages",
    JSON.stringify(payload.allowedLanguages || ["javascript", "python", "cpp"]),
  );
  if (payload.resumeText) {
    formData.append("pdf", payload.resumeText);
  }
  const res = await fetch(`${baseUrl}/api/interviews/createinterviewsession`, {
    method: "POST",
    credentials: "include",
    body: formData,
    
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = "Failed to initiate session setup.";
    try {
      const errData = JSON.parse(errorText);
      errorMessage = errData.error || errorMessage;
    } catch {
      console.error("Backend returned non-JSON error:", errorText);
      errorMessage = `Server Error: ${res.status} - Check backend console.`;
    }
    throw new Error(errorMessage);
  }
  return res.json();
};

export const useCreateInterviewSession = () => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const router = useRouter();

  return useMutation({
    mutationFn: createInterviewSession,
    onError: (error: any) => {
      toast.error(error.message || "Failed to create interview session");
    },
    onSuccess: (responseData) => {
      const interviewId = responseData.interviewId;
      dispatch(setTargetSession({ interviewId }));
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      toast.success("Interview session created successfully!");
      router.push(`/interview/${interviewId}/setup`);
    },
  });
};
