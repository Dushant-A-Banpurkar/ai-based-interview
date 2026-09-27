/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { toast } from "sonner";

const endInterviewSession = async (interviewId: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:6000";

  const res = await fetch(`${baseUrl}/api/interviews/${interviewId}/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ interviewId }),
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Failed to terminate current session.");
  }
  return res.json();
};

export const useEndInterview = () => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  return useMutation({
    mutationFn: endInterviewSession,
    onError: (error: any) => {
      throw new Error(error.message || "Failed to end interview");
    },
    onSuccess: (data, interviewId) => {
      toast.success("Interview complete. Evaluation report has been queued.");
      dispatch({ type: "interview/clearActiveSession" });

      queryClient.invalidateQueries({
        queryKey: ["interviewStatus", interviewId],
      });
    },
  });
};
