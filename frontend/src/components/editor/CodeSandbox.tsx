/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { Editor, OnMount } from "@monaco-editor/react";
import { useRef, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectActiveInterviewId,
  selectSandboxOutput,
} from "@/src/store/selectors/interviewSelectors";
import { updateSandboxOutput } from "@/src/store/slices/interviewSlice";

const LANGUAGE_TEMPLATES: Record<string, string> = {
  javascript: `// Write your JavaScript solution here\n\nfunction solve() {\n  \n}\n`,
  python: `# Write your Python solution here\n\ndef solve():\n    pass\n`,
  cpp: `// Write your C++ solution here\n#include <iostream>\n\nint main() {\n    return 0;\n}\n`,
};

export default function CodeSandbox() {
  const dispatch = useDispatch();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  const [language, setLanguage] = useState<string>("javascript");
  const [isExecuting, setIsExecuting] = useState(false);

  const interviewId = useSelector(selectActiveInterviewId);
  const sandboxResultOutput = useSelector(selectSandboxOutput);

  useEffect(() => {
    setIsExecuting(false);
  }, [sandboxResultOutput]);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);

    if (editorRef.current) {
      editorRef.current.setValue(LANGUAGE_TEMPLATES[newLang]);
    }
  };

  const runCode = () => {
    if (!editorRef.current) return;
    if (!interviewId) {
      console.error(
        "Execution Aborted: Missing active interviewId context parameters.",
      );
      return;
    }

    const sourceCode = editorRef.current.getValue();
    setIsExecuting(true);

    dispatch(
      updateSandboxOutput({
        stdout: "Executing code in secure sandbox environment...",
        stderr: null,
      }),
    );

    dispatch({
      type: "socket/emit",
      payload: {
        event: "sandbox_execute",
        data: {
          interviewId,
          language,
          code: sourceCode,
        },
      },
    });
  };

  const formatSandboxOutput = (output: unknown): string => {
    if (typeof output === "string") {
      return output;
    }
    if (output && typeof output === "object") {
      const res = output as {
        stdout?: string | null;
        stderr?: string | null;
        error?: string;
      };
      return res.stderr || res.stdout || res.error || "Sandbox ready.";
    }
    return "Sandbox ready.";
  };

  const formattedOutput = formatSandboxOutput(sandboxResultOutput);

  return (
    <div className="flex h-full w-full flex-col border-l border-slate-800 bg-slate-950 selection:bg-blue-500/20">
      <div className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/40 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-400">
            Environment:
          </span>
          <select
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white transition duration-150 focus:border-blue-500 focus:outline-none"
            value={language}
            onChange={handleLanguageChange}
          >
            <option value="javascript">Node.js (JavaScript)</option>
            <option value="python">Python 3</option>
            <option value="cpp">C++ (GCC)</option>
          </select>
        </div>

        <button
          onClick={runCode}
          disabled={isExecuting}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-950/20 transition-all duration-150 hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none disabled:opacity-50"
        >
          {isExecuting ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Running...
            </span>
          ) : (
            "Run Code"
          )}
        </button>
      </div>

      <div className="relative min-h-[250px] w-full flex-1 bg-slate-950">
        <Editor
          height="100%"
          theme="vs-dark"
          language={language}
          value={LANGUAGE_TEMPLATES[language]}
          onMount={handleEditorDidMount}
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
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
          }}
        />
      </div>

      <div className="flex h-52 flex-col justify-between border-t border-slate-800 bg-black p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Standard Output
        </p>
        <pre className="flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-900 bg-slate-950/40 p-3 font-mono text-xs leading-relaxed text-slate-300 shadow-inner">
          {formattedOutput}
        </pre>
      </div>
    </div>
  );
}
