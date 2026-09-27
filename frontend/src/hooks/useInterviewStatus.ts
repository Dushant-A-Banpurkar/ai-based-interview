"use client";

import { useQuery } from "@tanstack/react-query";

const fetchInterviewStatus = async (interviewId: string) => {
  if (!interviewId) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:6000";

  const res = await fetch(`${baseUrl}/api/interviews/${interviewId}/status`);

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
