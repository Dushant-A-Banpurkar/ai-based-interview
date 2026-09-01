import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import * as dotenv from "dotenv";
import {
  CandidateReportSchema,
  CandidateReport,
} from "../schemas/candidateReport.schema";
import { CodeSubmissionItem, TranscriptItem } from "../queues/meyda.queue";
import { AggregatedAudioTelemetry } from "../utils/meydaAggregator";
dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface InterviewDataPayload {
  transcript: TranscriptItem[];
  codeSubmissions:CodeSubmissionItem[];
  audioTelemetryAverage:AggregatedAudioTelemetry[]|null;
}

const system_prompt=`
You are an expert technical interviewer and speech dynamics analyst. Your task is to analyze a completed AI technical interview session and output a structured candidate evaluation report.

You will be provided with three data streams from the interview session:
1. **TRANSCRIPT**: Timestamps, interviewer questions, and candidate responses.
2. **CODE_SUBMISSIONS**: The candidate's source code, target language, and execution results from a sandboxed runner (stdout, stderr, pass/fail status).
3. **AUDIO_TELEMETRY**: Aggregated Meyda feature metrics calculated from the candidate's live audio:
   - RMS (Root Mean Square): Measures signal loudness and energy volume.
   - Spectral Centroid: Indicates "brightness" of sound (higher values correlate with higher pitch / sharp emphasis; sudden drops indicate slurring/muttering).
   - Zero Crossing Rate (ZCR): High values signal noise/unstable delivery or heavy breathiness; low values indicate steady vocal tones.

---
### EVALUATION GUIDELINES

#### Technical & Code Execution (40% Weight)
- Evaluate code correctness, time/space complexity (Big O), modularity, and handling of edge cases.
- Consider sandbox output: Did the candidate's code execute cleanly or throw runtime/compilation errors?
- Reward clean syntax, meaningful variable naming, and proper validation.

#### Communication & Content (40% Weight)
- Assess answer completeness, logical structuring (e.g., STAR method alignment), and domain accuracy.
- Identify technical hallucinations, vagueness, or failure to address the core prompt.

#### Acoustic Telemetry & Delivery (20% Weight)
- Cross-reference speech transcript content with Meyda telemetry:
  * **Steady RMS + Balanced Spectral Centroid**: Indicates calm, controlled, confident delivery.
  * **Extremely low RMS spikes**: Indicates trailing off at the ends of sentences or lack of vocal presence.
  * **Erratic Spectral Centroid / High ZCR variance**: Signals nervousness, vocal tremor, or high hesitation during difficult questions.
- Note: Do NOT penalize candidates for technical audio glitches; focus on sustained vocal delivery trends across the interview duration.

---
### OUTPUT REQUIREMENTS
Output MUST strictly follow the provided JSON schema. Be objective, precise, and actionable. Avoid generic filler praise.`

export async function generateCandidateReport(
  data: InterviewDataPayload,
): Promise<CandidateReport> {
  const userContent = `
    ### transcript
    ${JSON.stringify(data.transcript, null, 2)}
    
    ### CODE_SUBMISSIONS
    ${(JSON.stringify(data.codeSubmissions), null, 2)}
    
    ### AUDIO_TELEMETRY
    ${(JSON.stringify(data.audioTelemetryAverage), null, 2)}`;

    const chatcompletion=await openai.chat.completions.create({
      model:'gpt-4o-2024-08-06',
      messages:[{role:'system',content:system_prompt},{role:'user',content:userContent}],
      temperature:0.2,
      response_format:zodResponseFormat(CandidateReportSchema,'candidate_report')
    })
    const report:any= chatcompletion.choices[0].message.content;
    if(!report){
      throw new Error('Failed to parse candidate report from OpenAI response.')
    }
    return report;
}
