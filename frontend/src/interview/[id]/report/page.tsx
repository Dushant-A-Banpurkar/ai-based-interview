/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useParams } from "next/navigation";

const fetchReport = async (interviewId: string) => {
  const { data } = await axios.get(`/api/interviews/${interviewId}/report`);
  return data.report;
};

export default function ReportDashboard() {
  const params = useParams();
  const interviewId = params.id as string;

  const {
    data: report,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["interviewId", interviewId],
    queryFn: () => fetchReport(interviewId),
    staleTime: Infinity,
    retry: 2,
  });
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500"></div>
          <p>Analyzing interview telemetry and generating report...</p>
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-red-400">
        <p>
          Failed to load the interview report. The session may still be
          processing.
        </p>
      </div>
    );
  }
  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-200">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header & Executive Summary */}
        <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              AI Evaluation Report
            </h1>
            <p className="text-slate-400 mt-1 font-mono text-sm">
              Session ID: {interviewId}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wider ${
                report.recommendation.includes("Hire")
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : report.recommendation.includes("Reject")
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-slate-700 text-slate-300"
              }`}
            >
              {report.recommendation}
            </span>
            <span className="text-2xl font-black text-white">
              {report.overallScore} / 100
            </span>
          </div>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-3 text-lg font-semibold text-white">
            Executive Summary
          </h2>
          <p className="text-slate-300 leading-relaxed">
            {report.executiveSummary}
          </p>
        </section>

        {/* Core Evaluations Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Technical */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Technical Evaluation
              </h2>
              <span className="text-lg font-bold text-blue-400">
                {report.technicalEvaluation.score}/100
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Code Analysis
                </h3>
                <p className="text-sm text-slate-300">
                  {report.technicalEvaluation.codeAnalysis}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <h3 className="text-sm font-medium text-emerald-400 mb-2">
                    Strengths
                  </h3>
                  <ul className="list-disc pl-4 text-sm text-slate-300 space-y-1">
                    {report.technicalEvaluation.strengths.map(
                      (s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ),
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-amber-400 mb-2">
                    To Improve
                  </h3>
                  <ul className="list-disc pl-4 text-sm text-slate-300 space-y-1">
                    {report.technicalEvaluation.improvements.map(
                      (s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Communication */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Communication
              </h2>
              <span className="text-lg font-bold text-purple-400">
                {report.communicationEvaluation.score}/10
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Clarity & Structure
                </h3>
                <p className="text-sm text-slate-300">
                  {report.communicationEvaluation.clarityAndStructure}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Delivery & Confidence
                </h3>
                <p className="text-sm text-slate-300">
                  {report.communicationEvaluation.deliveryAndConfidence}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Red Flags (Conditional) */}
        {report.redFlags && report.redFlags.length > 0 && (
          <section className="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
            <h2 className="mb-3 text-lg font-semibold text-red-400">
              Critical Flags Identified
            </h2>
            <ul className="list-disc pl-5 text-red-300 space-y-1">
              {report.redFlags.map((flag: string, index: number) => (
                <li key={index}>{flag}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Question Breakdown */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-6 text-lg font-semibold text-white">
            Question Breakdown
          </h2>
          <div className="space-y-6">
            {report.questionBreakdown.map((q: any, idx: number) => (
              <div
                key={idx}
                className="border-b border-slate-800 pb-6 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="font-medium text-slate-200">
                    Q{idx + 1}: {q.questionText}
                  </h3>
                  <span className="shrink-0 rounded bg-slate-800 px-2 py-1 text-sm font-bold text-slate-300">
                    {q.score}/10
                  </span>
                </div>
                <div className="pl-4 border-l-2 border-slate-700 space-y-2">
                  <p className="text-sm text-slate-400">
                    <span className="text-slate-300 font-medium">
                      Response:
                    </span>{" "}
                    {q.candidateResponseSummary}
                  </p>
                  <p className="text-sm text-slate-400">
                    <span className="text-slate-300 font-medium">
                      Takeaway:
                    </span>{" "}
                    {q.keyTakeaway}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
