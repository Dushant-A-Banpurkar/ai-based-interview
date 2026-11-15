"use client";

import Cookies from "js-cookie";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  AudioLines,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  LogOut,
  Plus,
  RefreshCw,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { useAuthUser } from "@/src/hooks/authMe";
import {
  useInterviewHistory,
  type InterviewHistoryItem,
} from "@/src/hooks/useInterviewHistory";

interface AuthIdentity {
  candidateId?: unknown;
  _id?: unknown;
  id?: unknown;
  firstname?: string;
  name?: string;
  email?: string;
}

interface AuthUser extends AuthIdentity {
  user?: AuthIdentity | null;
}

function asAuthUser(user: unknown): AuthUser | undefined {
  return user && typeof user === "object" ? (user as AuthUser) : undefined;
}

function getUserName(value: unknown): string {
  const user = asAuthUser(value);
  return (
    user?.user?.firstname ||
    user?.firstname ||
    user?.user?.name ||
    user?.name ||
    user?.user?.email?.split("@")[0] ||
    user?.email?.split("@")[0] ||
    ""
  );
}

function getCandidateId(value: unknown): string | undefined {
  const user = asAuthUser(value);
  if (!user) return undefined;
  const identity = user?.user ?? user;
  const id =
    identity?.candidateId ??
    identity?._id ??
    identity?.id ??
    user?.candidateId ??
    user?._id ??
    user?.id;

  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function getStoredUser(): AuthUser | undefined {
  try {
    const storedUser = Cookies.get("user_session");
    return storedUser ? asAuthUser(JSON.parse(storedUser)) : undefined;
  } catch {
    return undefined;
  }
}

function formatSessionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusDetails(status: InterviewHistoryItem["status"]) {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: "border-emerald-300/15 bg-emerald-300/[0.08] text-emerald-200",
        Icon: CheckCircle2,
      };
    case "processing":
      return {
        label: "Report processing",
        className: "border-amber-300/15 bg-amber-300/[0.08] text-amber-100",
        Icon: Clock3,
      };
    case "live":
      return {
        label: "In progress",
        className: "border-sky-300/15 bg-sky-300/[0.08] text-sky-100",
        Icon: AudioLines,
      };
    default:
      return {
        label: "Ready to begin",
        className: "border-indigo-300/15 bg-indigo-300/[0.08] text-indigo-100",
        Icon: RotateCw,
      };
  }
}

function sessionHref(session: InterviewHistoryItem): string {
  if (session.status === "completed" || session.status === "processing") {
    return `/interview/${session.id}/report`;
  }
  if (session.status === "scheduled") {
    return `/interview/${session.id}/setup`;
  }
  return `/interview/${session.id}`;
}

export default function Dashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();
  const storedUser = getStoredUser();
  const candidateId =
    getCandidateId(authUser) ?? getCandidateId(storedUser);
  const { data: interviews, isLoading, isError, error, refetch } =
    useInterviewHistory(candidateId);
  const userName = getUserName(authUser) || getUserName(storedUser);

  const handleSignOut = () => {
    queryClient.removeQueries({ queryKey: ["authUser"] });
    Cookies.remove("user_session");
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-[#080d18] text-slate-100 selection:bg-cyan-300/30">
      <header className="border-b border-white/[0.07] bg-slate-950/45">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link href="/dashboard" className="inline-flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <Bot className="size-5" />
            </span>
            <span className="text-sm font-semibold tracking-wide text-white">
              Interview Lab
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-400 sm:inline">
              {userName ? `Hi, ${userName}` : "Your practice space"}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700/80 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-10 px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-[#11233a] px-6 py-8 shadow-2xl shadow-black/20 sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-32 size-96 rounded-full bg-cyan-400/[0.08] blur-3xl"
          />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-200/[0.06] px-3 py-1.5 text-xs font-medium text-cyan-100">
                <Sparkles className="size-3.5" />
                Your interview practice
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {userName ? `Welcome back, ${userName}.` : "Ready when you are."}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
                Start a technical mock interview or revisit a session and its
                report.
              </p>
            </div>
            <Link
              href="/interview"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110"
            >
              <Plus className="size-4" />
              Start an interview
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200/70">
                Your activity
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                Recent interview sessions
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Your latest sessions and their current status
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/55">
            {isAuthLoading && !candidateId ? (
              <div className="flex items-center gap-3 px-6 py-12 text-sm text-slate-400">
                <RefreshCw className="size-4 animate-spin text-cyan-200" />
                Loading your account…
              </div>
            ) : !candidateId ? (
              <div className="px-6 py-12 text-center sm:px-10">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-300">
                  <Bot className="size-5" />
                </div>
                <h3 className="mt-4 font-medium text-white">
                  We couldn’t find your account
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                  Sign in again to load sessions saved to your account.
                </p>
                <Link
                  href="/"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-200 hover:text-white"
                >
                  Return to sign in <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-3 px-6 py-12 text-sm text-slate-400">
                <RefreshCw className="size-4 animate-spin text-cyan-200" />
                Loading your interview history…
              </div>
            ) : isError ? (
              <div className="px-6 py-12 text-center sm:px-10">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-rose-300/10 text-rose-200">
                  <FileText className="size-5" />
                </div>
                <h3 className="mt-4 font-medium text-white">
                  Interview history couldn’t be loaded
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                  {error instanceof Error
                    ? error.message
                    : "Please check your connection and try again."}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
                >
                  <RefreshCw className="size-3.5" />
                  Try again
                </button>
              </div>
            ) : !interviews?.length ? (
              <div className="px-6 py-12 text-center sm:px-10">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-800 text-cyan-200">
                  <CalendarDays className="size-5" />
                </div>
                <h3 className="mt-4 font-medium text-white">
                  No interview sessions yet
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                  When you complete or start a practice session, it will appear
                  here.
                </p>
                <Link
                  href="/interview"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-200 hover:text-white"
                >
                  Start your first interview <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {interviews.map((session) => {
                  const { label, className, Icon } = statusDetails(session.status);
                  return (
                    <li
                      key={session.id}
                      className="flex flex-col gap-4 px-5 py-5 transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="font-medium text-white">
                            {session.roleTitle}
                          </h3>
                          <span className="rounded-md border border-slate-700/80 bg-slate-950/60 px-2 py-1 text-[11px] capitalize text-slate-400">
                            {session.difficultyMode}
                          </span>
                        </div>
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="size-3.5" />
                            {formatSessionDate(session.createdAt)}
                          </span>
                          <span>{session.durationMinutes} min</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${className}`}
                        >
                          <Icon className="size-3.5" />
                          {label}
                        </span>
                        <Link
                          href={sessionHref(session)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-200 transition hover:text-white"
                        >
                          {session.status === "completed"
                            ? "View report"
                            : session.status === "processing"
                              ? "Check report"
                              : "Open session"}
                          <ArrowRight className="size-4" />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {interviews && interviews.length === 20 && (
            <p className="mt-3 text-right text-xs text-slate-500">
              Showing the 20 most recent sessions.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
