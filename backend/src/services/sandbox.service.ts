import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();
interface ExecutionResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: { id: number; description: string };
}
export async function executeCode(
  sourceCode: string,
  languageId: number,
): Promise<ExecutionResult> {
  const response = await axios.post<ExecutionResult>(
    "https://judge0-ce.p.rapidapi.com/submissions?wait=true",
    {
      source_code: sourceCode,
      language_id: languageId,
      cpu_time_limit: 2,
    },
    {
      headers: {
        "X-RapidAPI-Key": process.env.JUDGE0_API_KEY,
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
}
