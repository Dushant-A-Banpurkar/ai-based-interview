"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchInterviewBackend } from "../lib/interviewBackend";

const fetchInterviewStatus = async (interviewId: string) => {
  if (!interviewId) return null;

  const res = await fetchInterviewBackend(`/api/interviews/${interviewId}/status`);

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to sync status details.");
  }

  return res.json();
};

export const useInterviewStatus = (interviewId: string) => {
  return useQuery({
    queryKey: ["interviewStatus", interviewId],
    queryFn: () => fetchInterviewStatus(interviewId),
    enabled: !!interviewId,
    refetchInterval: (query) => {
      return query.state.data?.status === "processing" ? 5000 : false;
    },
  });
};
