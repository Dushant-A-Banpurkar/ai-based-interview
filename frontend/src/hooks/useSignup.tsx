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

interface signUpForm {
  firstname: string;
  lastname: string;
  username: string;
  email: string;
  password: string;
}

interface SignUpResponse {
  message?: string;
  success: boolean;
  user?: {
    id: string;
    email: string;
    username: string;
  };
  [key: string]: any;
}

const signup = async (formData: signUpForm): Promise<SignUpResponse> => {
  const url = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:6000";

  const res = await fetch(`/api/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(formData),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to Create Account");
  }
  return res.json();
};

export const useSignUp = () => {
  const [formData, setFormData] = useState<signUpForm>({
    firstname: "",
    lastname: "",
    username: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const router = useRouter();
  const mutation: UseMutationResult<SignUpResponse, Error, signUpForm> =
    useMutation({
      mutationFn: signup,
      onError: (error: any) => {
        setErrors({ general: error.message || "Failed to Create Account" });
       
      },
      onSuccess: async () => {
       
        await queryClient.invalidateQueries({ queryKey: ["authUser"] });
        
        router.push("/dashboard");
      },
    } as UseMutationOptions<SignUpResponse, Error, signUpForm>);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    mutation.mutate(formData);
  };

  return [formData, errors, handleInputChange, handleSubmit, mutation] as const;
};
