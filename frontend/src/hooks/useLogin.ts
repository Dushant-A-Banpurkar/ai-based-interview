"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface LoginForm {
  email: string;
  password: string;
}
interface AuthUserResponse {
  token?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  [key: string]: any;
}
const signin = async (data: LoginForm): Promise<AuthUserResponse> => {
  const url = process.env.NEXT_PUBLIC_BACKEND_API;
  const res = await fetch(`${url}/api/auth/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to Login");
  }

  return res.json();
};

export const useSignIn = () => {
  const [formData, setFormData] = useState<LoginForm>({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation: UseMutationResult<AuthUserResponse, Error, LoginForm> =
    useMutation({
      mutationFn: signin,
      onError: (err: any) => {
        setErrors({ general: err.message || "Something went wrong" });
      },
      onSuccess: async (responseData) => {
        queryClient.setQueryData(["authUser"], responseData);
        await queryClient.invalidateQueries({ queryKey: ["authUser"] });
        router.push("/dashboard");
      },
    } as UseMutationOptions<AuthUserResponse, Error, LoginForm>);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    mutation.mutate(formData);
  };

  return [mutation, formData, errors, handleInputChange, handleSubmit] as const;
};
