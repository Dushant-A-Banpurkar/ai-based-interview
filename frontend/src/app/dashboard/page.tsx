"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Plus,
  Play,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  Briefcase,
  Bot,
  ArrowRight,
  LogOut,
  Award,
  BarChart3,
} from "lucide-react";


const RECENT_INTERVIEWS = [
  {
    id: "65f210a9c841e2123456789a",
    roleTitle: "Full Stack Engineer",
    difficultyMode: "hard",
    status: "completed",
    score: 88,
    createdAt: "2026-03-28",
  },
  {
    id: "65f210a9c841e2123456789b",
    roleTitle: "Backend Node.js Developer",
    difficultyMode: "medium",
    status: "processing",
    score: null,
    createdAt: "2026-03-29",
  },
  {
    id: "65f210a9c841e2123456789c",
    roleTitle: "Frontend React Engineer",
    difficultyMode: "beginner",
    status: "scheduled",
    score: null,
    createdAt: "2026-03-25",
  },
];

export default function Dashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Retrieve cached auth user if available
  const authUser = queryClient.getQueryData<{ user?: { firstname?: string; email?: string } }>(["authUser"]);
  const userName = authUser?.user?.firstname || "Engineer";

  const handleSignOut = () => {
    queryClient.removeQueries({ queryKey: ["authUser"] });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Bot className="size-5" />
            </div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              AI Job Tracker
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 font-medium">
              Welcome back, <span className="text-white font-semibold">{userName}</span>
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-700 hover:text-white transition duration-150"
            >
              <LogOut className="size-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Hero Section / Call to Action */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-blue-950/30 p-8 shadow-2xl backdrop-blur-md">
          <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
                <Sparkles className="size-3.5" />
                <span>AI Technical Interview Room Ready</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready for your next mock interview?
              </h1>
              <p className="text-sm leading-relaxed text-slate-400">
                Practice real-time coding, acoustic voice telemetry analysis, and get instantaneous evaluation reports tailored to target job descriptions.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/interview"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition duration-200 hover:from-blue-500 hover:to-indigo-500"
              >
                <Plus className="size-4" />
                Start New Interview
              </Link>
            </div>
          </div>
        </div>

        {/* Analytics & Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Interviews</span>
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
                <BarChart3 className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-white">12</p>
            <span className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
              <TrendingUp className="size-3" /> +3 this week
            </span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Average Performance</span>
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
                <Award className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-white">84%</p>
            <span className="mt-1 text-[11px] text-slate-400">Top area: Problem Solving</span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Applications Tracked</span>
              <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400 border border-indigo-500/20">
                <Briefcase className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-white">18</p>
            <span className="mt-1 text-[11px] text-slate-400">5 active interview stages</span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Completed Sessions</span>
              <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-white">9</p>
            <span className="mt-1 text-[11px] text-slate-400">Reports generated</span>
          </div>
        </div>

        {/* Recent Mock Interviews List */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent Interview Sessions</h2>
              <p className="text-xs text-slate-400">Track and review past mock technical assessments</p>
            </div>
            <Link
              href="/interview/setup"
              className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition"
            >
              Create New <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-800/60">
            {RECENT_INTERVIEWS.map((session) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4 transition hover:bg-slate-900/50 rounded-xl px-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-semibold text-slate-100">{session.roleTitle}</h3>
                    <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-mono capitalize text-slate-400">
                      {session.difficultyMode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: {session.id} • Created {session.createdAt}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  {/* Status Badge */}
                  {session.status === "completed" && (
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      <span>Score: {session.score}/100</span>
                    </div>
                  )}

                  {session.status === "processing" && (
                    <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                      <Clock className="size-3.5 animate-spin" />
                      <span>Analyzing Report...</span>
                    </div>
                  )}

                  {session.status === "scheduled" && (
                    <div className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
                      <Play className="size-3.5" />
                      <span>Ready to Start</span>
                    </div>
                  )}

                  {/* Actions */}
                  {session.status === "completed" ? (
                    <Link
                      href={`/interview/${session.id}/report`}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600 hover:text-white transition"
                    >
                      <FileText className="size-3.5 text-blue-400" />
                      View Report
                    </Link>
                  ) : (
                    <Link
                      href={`/interview/${session.id}`}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-600/40 bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-600/30 transition"
                    >
                      <Play className="size-3.5" />
                      Enter Session
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}