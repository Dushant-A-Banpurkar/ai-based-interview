"use client";
import { useQuery } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { useEffect } from "react";
const fetchAuthUser = async () => {
  const response = await fetch(`/api/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
};

export const useAuthUser = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["authUser"],
    queryFn: fetchAuthUser,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (data) {
      Cookies.set("user_session", JSON.stringify(data), { expires: 7 });
    }
  }, [data]);
  return { data, isLoading, isError, error };
};
