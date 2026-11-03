"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchInterviewBackend } from "../lib/interviewBackend";

export interface InterviewStatusResponse {
  interviewId: string;
  status: "scheduled" | "live" | "processing" | "completed";
  roleTitle: string;
  durationMinutes: number;
  interviewStartedAt: string | null;
}

const fetchInterviewStatus = async (
  interviewId: string,
): Promise<InterviewStatusResponse | null> => {
  if (!interviewId) return null;

  const res = await fetchInterviewBackend(`/api/interviews/${interviewId}/status`);

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to sync status details.");
  }

  return (await res.json()) as InterviewStatusResponse;
};

export const useInterviewStatus = (interviewId: string) => {
  return useQuery({
    queryKey: ["interviewStatus", interviewId],
    queryFn: () => fetchInterviewStatus(interviewId),
    enabled: !!interviewId,
    refetchInterval: (query) => {
      const interview = query.state.data;
      if (interview?.status === "scheduled" && !interview.interviewStartedAt) {
        return 2000;
      }
      return interview?.status === "processing" ? 5000 : false;
    },
  });
};
