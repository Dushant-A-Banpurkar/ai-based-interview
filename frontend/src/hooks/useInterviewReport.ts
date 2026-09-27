"use client";

import { useQuery } from "@tanstack/react-query";

const fetchInterviewReport = async (interviewId: string) => {
  if (!interviewId) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:6000";

  const res = await fetch(`${baseUrl}/api/interviews/${interviewId}/report`);

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
