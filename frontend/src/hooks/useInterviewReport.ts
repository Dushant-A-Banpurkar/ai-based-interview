"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchInterviewBackend } from "../lib/interviewBackend";

const fetchInterviewReport = async (interviewId: string) => {
  if (!interviewId) return null;

  const res = await fetchInterviewBackend(`/api/interviews/${interviewId}/report`);

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(
      errData.error || "Failed to fetch candidate assessment profile.",
    );
  }

  return res.json();
};

export const useInterviewReport = (interviewId: string) => {
  return useQuery({
    queryKey: ["interviewReport", interviewId],
    queryFn: () => fetchInterviewReport(interviewId),
    enabled: !!interviewId,
    retry: 2,
  });
};
