"use client";

import { Editor, OnMount } from "@monaco-editor/react";
import { useRef, useState } from "react";
import { useDispatch } from "react-redux";

const LANGUAGE_TEMPLATES: Record<string, string> = {
  javascript: `// Write your JavaScript solution here\n\nfunction solve() {\n \n}\n`,
  python: `# Write your Python solution here\n\nedf solve():\n   pass\n`,
  cpp: `// Write your C++ solution here\n#include <iostream>\n\init main() {\n   return 0;\n}\n`,
};

export default function CodeSandbox() {
  const dispatch = useDispatch();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  const [language, setLanguage] = useState<string>("javascript");
  const [output, setOutput] = useState<string>(
    "Sandbox ready. Output will appear here...",
  );
  const [isExecuting, setIsExecuting] = useState(false);

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

    const sourceCode = editorRef.current.getValue();
    setIsExecuting(true);
    setOutput("Executing code in secure sandbox...");

    dispatch({
      type: "socket/emit",
      payload: {
        event: "sandbox_execute",
        data: { language, code: sourceCode },
      },
    });

    setTimeout(() => {
      setIsExecuting(false);
    }, 2000);
  };

  return (
    <div className="flex h-full flex-col border-l border-slate-800 bg-slate-950">

      <div className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-300">
            Environment:
          </span>
          <select
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
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
          className="flex items-center gap-2 rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {isExecuting ? "Running..." : "Run Code"}
        </button>
      </div>

  
      <div className="flex-1">
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
          }}
        />
      </div>

 
      <div className="h-48 border-t border-slate-800 bg-black p-4">
        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Standard Output
        </p>
        <pre className="h-full overflow-y-auto whitespace-pre-wrap font-mono text-sm text-slate-300">
          {output}
        </pre>
      </div>
    </div>
  );
}
