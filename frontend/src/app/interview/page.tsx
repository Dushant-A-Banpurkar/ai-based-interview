/* eslint-disable react-hooks/immutability */
"use client";

import { useCreateInterviewSession } from "@/src/hooks/useCreateInterviewSession";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthUser } from "@/src/hooks/authMe";
import Cookies from "js-cookie";

export default function StartNewInterviewPage() {
  let { data: user } = useAuthUser();
  const { mutate: createSession, isPending } = useCreateInterviewSession();

  const [formData, setFormData] = useState({
    roleTitle: "",
    jobDescription: "",
    difficultyMode: "medium",
    enableSandbox: true,
    targetSkills: "",
    allowedLanguages: "javascript, python, cpp",
  });

  const [resumeText, setResumeFile] = useState<File | null>(null);

  const authUserCookie = Cookies.get("user_session");
  if (!authUserCookie) {
    toast.error("Cookies expired or user not found. Please log in again.");
    return;
  }
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    if (type === "file") {
      const fileInput = e.target as HTMLInputElement;
      const file = fileInput.files?.[0];
      if (file) {
        setFormData((prev) => ({ ...prev, resumeText: file }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]:
          type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 2. Validate against the TanStack Query user data instead of cookies
    if (!user) {
      try {
        const authUser = JSON.parse(authUserCookie);
        // FIXED: Resilient fallback to read candidateId across all possible auth structures
        user =
          authUser.candidateId ||
          authUser.user?.id ||
          authUser.user?._id ||
          authUser.id ||
          authUser._id;
      } catch {
        user = authUserCookie;
      }
    }

    // 3. Safely extract the ID based on your user object structure
    const candidateId = user._id || user.id || user.candidateId;

    if (!candidateId) {
      toast.error("Could not find a valid candidateId in your session.");
      return;
    }

    const payload = {
      candidateId,
      roleTitle: formData.roleTitle,
      jobDescription: formData.jobDescription,
      difficultyMode: formData.difficultyMode as
        | "beginner"
        | "medium"
        | "hard"
        | "extreme",
      enableSandbox: formData.enableSandbox,
      targetSkills: formData.targetSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      allowedLanguages: formData.allowedLanguages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      resumeText: resumeText,
    };

    createSession(payload);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10 text-black">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Start New Interview
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role Title
          </label>
          <input
            type="text"
            name="roleTitle"
            required
            placeholder="e.g., Full Stack Developer"
            value={formData.roleTitle}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Description
          </label>
          <textarea
            name="jobDescription"
            required
            rows={4}
            placeholder="Paste the job description here..."
            value={formData.jobDescription}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Difficulty Mode
            </label>
            <select
              name="difficultyMode"
              value={formData.difficultyMode}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="beginner">Beginner</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="extreme">Extreme</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload Resume (Optional)
            </label>
            <input
              name="resumeText"
              type="file"
              accept=".pdf"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              className="w-full border border-gray-300 rounded-md p-1.5 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Skills (Comma separated)
          </label>
          <input
            type="text"
            name="targetSkills"
            required
            placeholder="React, Node.js, MongoDB, System Design"
            value={formData.targetSkills}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Allowed Languages (Comma separated)
          </label>
          <input
            type="text"
            name="allowedLanguages"
            placeholder="javascript, python, cpp"
            value={formData.allowedLanguages}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="enableSandbox"
            id="enableSandbox"
            checked={formData.enableSandbox}
            onChange={handleInputChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="enableSandbox"
            className="ml-2 block text-sm text-gray-900"
          >
            Enable Coding Sandbox
          </label>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending
            ? "Setting up Interview Room..."
            : "Create Interview Session"}
        </button>
      </form>
    </div>
  );
}
