"use client";

import { useState } from "react";
import Link from "next/link";
import { useSignIn } from "@/src/hooks/useLogin";
import { useSignUp } from "@/src/hooks/useSignup";
import {
  ArrowRight,
  AudioLines,
  Bot,
  Braces,
  Check,
  FileText,
  Sparkles,
} from "lucide-react";

const fieldClassName =
  "mt-2 w-full rounded-xl border border-slate-700/80 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10";

export default function Home() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [
    loginMutation,
    loginData,
    loginErrors,
    handleLoginChange,
    handleLoginSubmit,
  ] = useSignIn();
  const [
    signupData,
    signupErrors,
    handleSignupChange,
    handleSignupSubmit,
    signupMutation,
  ] = useSignUp();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080d18] text-white selection:bg-cyan-300/30">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_22%,rgba(8,145,178,0.16),transparent_38%),radial-gradient(ellipse_at_84%_76%,rgba(79,70,229,0.16),transparent_35%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Interview Lab home">
            <span className="flex size-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <Bot className="size-5" />
            </span>
            <span className="text-sm font-semibold tracking-wide text-slate-100">
              Interview Lab
            </span>
          </Link>
          <span className="hidden text-sm text-slate-400 sm:inline">
            {isSignUp ? "Already have an account?" : "New to Interview Lab?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignUp((current) => !current)}
              className="font-medium text-cyan-200 transition hover:text-white"
            >
              {isSignUp ? "Sign in" : "Create an account"}
            </button>
          </span>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:py-16">
          <section className="mx-auto w-full max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-200/[0.06] px-3.5 py-2 text-xs font-medium text-cyan-100">
              <Sparkles className="size-3.5" />
              A focused space to practice technical interviews
            </div>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Get comfortable
              <span className="block bg-gradient-to-r from-cyan-200 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                thinking out loud.
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-400 sm:text-lg">
              Run a technical mock interview, talk through your approach, and
              review an AI-generated report when you finish.
            </p>

            <div className="mt-10 space-y-4">
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 text-cyan-200">
                  <AudioLines className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-medium text-slate-100">
                    Live, voice-led practice
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Respond to interview prompts in a real-time session.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 text-cyan-200">
                  <Braces className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-medium text-slate-100">
                    Optional coding sandbox
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Work through a coding exercise when the session includes one.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 text-cyan-200">
                  <FileText className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-medium text-slate-100">
                    A report after your session
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Review feedback and question-by-question takeaways.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 flex items-center gap-2 border-t border-slate-800/80 pt-5 text-xs text-slate-500">
              <Check className="size-3.5 text-emerald-300" />
              Set up a role, difficulty, and session length before you begin.
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-[0_30px_100px_-40px_rgba(8,145,178,0.3)] backdrop-blur-xl sm:p-8">
              <div className="mb-7">
                <div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300/20 to-indigo-400/20 text-cyan-100">
                  <Bot className="size-5" />
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200/80">
                  {isSignUp ? "Get started" : "Welcome back"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  {isSignUp ? "Create your account" : "Sign in to continue"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {isSignUp
                    ? "Create an account to start your interview practice."
                    : "Pick up where you left off and prepare for your next interview."}
                </p>
              </div>

              <div
                className="mb-6 grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-950/70 p-1"
              >
                <button
                  type="button"
                  aria-pressed={!isSignUp}
                  onClick={() => setIsSignUp(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    !isSignUp
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  aria-pressed={isSignUp}
                  onClick={() => setIsSignUp(true)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isSignUp
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sign up
                </button>
              </div>

              {!isSignUp ? (
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  {loginErrors.general && (
                    <p
                      role="alert"
                      className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
                    >
                      {loginErrors.general}
                    </p>
                  )}
                  <label className="block text-sm font-medium text-slate-300">
                    Email address
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      value={loginData.email}
                      onChange={handleLoginChange}
                      placeholder="you@example.com"
                      className={fieldClassName}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-300">
                    Password
                    <input
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      required
                      value={loginData.password}
                      onChange={handleLoginChange}
                      placeholder="Enter your password"
                      className={fieldClassName}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loginMutation.isPending ? "Signing in…" : "Sign in"}
                    {!loginMutation.isPending && (
                      <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  {signupErrors.general && (
                    <p
                      role="alert"
                      className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
                    >
                      {signupErrors.general}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm font-medium text-slate-300">
                      First name
                      <input
                        type="text"
                        name="firstname"
                        autoComplete="given-name"
                        required
                        value={signupData.firstname}
                        onChange={handleSignupChange}
                        placeholder="First name"
                        className={fieldClassName}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-300">
                      Last name
                      <input
                        type="text"
                        name="lastname"
                        autoComplete="family-name"
                        required
                        value={signupData.lastname}
                        onChange={handleSignupChange}
                        placeholder="Last name"
                        className={fieldClassName}
                      />
                    </label>
                  </div>
                  <label className="block text-sm font-medium text-slate-300">
                    Username
                    <input
                      type="text"
                      name="username"
                      autoComplete="username"
                      required
                      value={signupData.username}
                      onChange={handleSignupChange}
                      placeholder="Choose a username"
                      className={fieldClassName}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-300">
                    Email address
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      value={signupData.email}
                      onChange={handleSignupChange}
                      placeholder="you@example.com"
                      className={fieldClassName}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-300">
                    Password
                    <input
                      type="password"
                      name="password"
                      autoComplete="new-password"
                      required
                      value={signupData.password}
                      onChange={handleSignupChange}
                      placeholder="Create a password"
                      className={fieldClassName}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={signupMutation.isPending}
                    className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {signupMutation.isPending
                      ? "Creating account…"
                      : "Create account"}
                    {!signupMutation.isPending && (
                      <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                    )}
                  </button>
                </form>
              )}
              <p className="mt-6 text-center text-xs leading-5 text-slate-500">
                Your interview sessions and reports appear in your dashboard.
              </p>
            </div>
            <p className="mt-5 text-center text-xs text-slate-600">
              Choose your practice setup when you start a session.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
