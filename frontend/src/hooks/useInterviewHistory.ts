"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchInterviewBackend } from "../lib/interviewBackend";

export interface InterviewHistoryItem {
  id: string;
  roleTitle: string;
  difficultyMode: "beginner" | "medium" | "hard" | "extreme";
  durationMinutes: number;
  status: "scheduled" | "live" | "processing" | "completed";
  createdAt: string;
}

const fetchInterviewHistory = async (
  candidateId: string,
): Promise<InterviewHistoryItem[]> => {
  const params = new URLSearchParams({ candidateId });
  const response = await fetchInterviewBackend(
    `/api/interviews/history?${params.toString()}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || "Failed to load interview history.");
  }

  const data = await response.json();
  return data.interviews;
};

export const useInterviewHistory = (candidateId?: string) =>
  useQuery({
    queryKey: ["interviews", "history", candidateId],
    queryFn: () => fetchInterviewHistory(candidateId!),
    enabled: Boolean(candidateId),
    retry: false,
  });
