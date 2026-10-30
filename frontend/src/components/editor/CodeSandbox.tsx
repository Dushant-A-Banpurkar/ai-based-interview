"use client";

import { Editor } from "@monaco-editor/react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectActiveInterviewId,
  selectCodingAllowedLanguages,
  selectCodingAssignment,
  selectCodingDraft,
  selectCodingDraftInitialized,
  selectCodingLanguage,
  selectCodingSecondsRemaining,
  selectCodingSubmissionState,
  selectCodingStatus,
  selectSandboxExecutionPending,
  selectSandboxOutput,
} from "@/src/store/selectors/interviewSelectors";
import {
  setCodingDraft,
  tickCodingTimer,
  updateSandboxOutput,
  setCodingSubmissionState,
} from "@/src/store/slices/interviewSlice";

const LANGUAGE_TEMPLATES: Record<string, string> = {
  javascript: `const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();

function solve(input) {
  // Implement your solution using the provided input.
  return "";
}

console.log(solve(input));
`,
  python: `import sys

def solve(input_text):
    # Implement your solution using the provided input.
    return ""

print(solve(sys.stdin.read().strip()))
`,
  cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
    // Implement your solution using the provided input.
    cout << "";
    return 0;
}
`,
};

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "Node.js (JavaScript)",
  python: "Python 3",
  cpp: "C++ (GCC)",
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
}

export default function CodeSandbox() {
  const dispatch = useDispatch();
  const interviewId = useSelector(selectActiveInterviewId);
  const assignment = useSelector(selectCodingAssignment);
  const codingDraft = useSelector(selectCodingDraft);
  const codingDraftInitialized = useSelector(selectCodingDraftInitialized);
  const savedLanguage = useSelector(selectCodingLanguage);
  const allowedLanguages = useSelector(selectCodingAllowedLanguages);
  const secondsRemaining = useSelector(selectCodingSecondsRemaining);
  const codingStatus = useSelector(selectCodingStatus);
  const submissionState = useSelector(selectCodingSubmissionState);
  const isExecuting = useSelector(selectSandboxExecutionPending);
  const sandboxResultOutput = useSelector(selectSandboxOutput);

  const availableLanguages = (
    allowedLanguages.length > 0
      ? allowedLanguages
      : (assignment?.supportedLanguages ?? ["javascript"])
  ).filter((language) => LANGUAGE_TEMPLATES[language]);

  const language = availableLanguages.includes(savedLanguage)
    ? savedLanguage
    : (availableLanguages[0] ?? "javascript");
  const code = codingDraftInitialized
    ? codingDraft
    : (LANGUAGE_TEMPLATES[language] ?? "");
  const isSubmitting = submissionState === "pending";

  useEffect(() => {
    if (codingStatus !== "active") return;
    const timerId = setInterval(() => {
      dispatch(tickCodingTimer());
    }, 1000);
    return () => clearInterval(timerId);
  }, [codingStatus, dispatch]);

  useEffect(() => {
    if (codingStatus !== "active" || !interviewId) return;
    const timeoutId = setTimeout(() => {
      dispatch({
        type: "socket/emit",
        payload: {
          event: "coding_draft",
          data: { language, code },
        },
      });
    }, 350);
    return () => clearTimeout(timeoutId);
  }, [code, codingStatus, dispatch, interviewId, language]);

  const handleCodeChange = (nextCode: string | undefined) => {
    const updatedCode = nextCode ?? "";
    dispatch(setCodingDraft({ code: updatedCode, language }));
  };

  const handleLanguageChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextLanguage = event.target.value;
    dispatch(setCodingDraft({ code, language: nextLanguage }));
  };

  const runCode = () => {
    if (!interviewId || codingStatus !== "active") return;
    dispatch(
      updateSandboxOutput({
        stdout: "Executing code in the sandbox...",
        stderr: null,
      }),
    );
    dispatch({
      type: "socket/emit",
      payload: {
        event: "sandbox_execute",
        data: { interviewId, language, code },
      },
    });
  };

  const submitCode = () => {
    if (!interviewId || codingStatus !== "active" || isSubmitting) return;
    dispatch(setCodingSubmissionState("pending"));
    dispatch({
      type: "socket/emit",
      payload: {
        event: "submit_coding",
        data: { language, code },
      },
    });
  };

  const formattedOutput =
    sandboxResultOutput || "Run your code to see output here.";

  return (
    <div className="flex h-full w-full flex-col border-l border-slate-800 bg-slate-950 selection:bg-blue-500/20">
      <section className="max-h-[34%] shrink-0 overflow-y-auto border-b border-slate-800 bg-slate-900/40 px-5 py-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              Coding assignment
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">
              {assignment?.title ?? "Assignment"}
            </h2>
          </div>
          <div
            aria-live="polite"
            className={`rounded-lg border px-3 py-1.5 font-mono text-sm ${
              secondsRemaining <= 60
                ? "border-red-500/40 bg-red-950/30 text-red-300"
                : "border-slate-700 bg-slate-900 text-slate-200"
            }`}
          >
            Time remaining: {formatTime(secondsRemaining)}
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
          {assignment?.statement}
        </p>
        {assignment?.functionSignature && (
          <p className="mt-3 rounded-lg bg-slate-950/70 p-3 font-mono text-xs text-blue-200">
            {assignment.functionSignature}
          </p>
        )}
        {assignment?.examples.map((example, index) => (
          <div
            key={`${assignment.problemId}-example-${index}`}
            className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs"
          >
            <p className="mb-1 font-semibold text-slate-300">
              Example {index + 1}
            </p>
            <p className="font-mono text-slate-400">
              Input: {example.input}
            </p>
            <p className="font-mono text-slate-400">
              Output: {example.output}
            </p>
            {example.explanation && (
              <p className="mt-1 text-slate-500">{example.explanation}</p>
            )}
          </div>
        ))}
        {!!assignment?.constraints.length && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-400">
            {assignment.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/40 px-4 backdrop-blur-sm">
        <label className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-400">
            Environment:
          </span>
          <select
            aria-label="Programming language"
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white transition duration-150 focus:border-blue-500 focus:outline-none"
            value={language}
            onChange={handleLanguageChange}
            disabled={codingStatus !== "active" || isSubmitting}
          >
            {availableLanguages.map((option) => (
              <option key={option} value={option}>
                {LANGUAGE_LABELS[option] ?? option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runCode}
            disabled={isExecuting || isSubmitting || codingStatus !== "active"}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExecuting ? "Running…" : "Run Code"}
          </button>
          <button
            type="button"
            onClick={submitCode}
            disabled={isSubmitting || codingStatus !== "active"}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? "Submitting…"
              : submissionState === "failed"
                ? "Retry Submit"
                : "Submit"}
          </button>
        </div>
      </div>

      <div className="relative min-h-[220px] w-full flex-1 bg-slate-950">
        <Editor
          height="100%"
          theme="vs-dark"
          language={language}
          value={code}
          onChange={handleCodeChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineNumbersMinChars: 3,
            cursorBlinking: "smooth",
            formatOnPaste: true,
            readOnly: codingStatus !== "active" || isSubmitting,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
          }}
        />
      </div>

      <div className="flex h-40 shrink-0 flex-col border-t border-slate-800 bg-black p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Run output
        </p>
        <pre className="flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-900 bg-slate-950/40 p-3 font-mono text-xs leading-relaxed text-slate-300 shadow-inner">
          {formattedOutput}
        </pre>
      </div>
    </div>
  );
}
