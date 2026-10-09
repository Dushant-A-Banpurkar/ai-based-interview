"use client";

import { useState } from "react";
import { useSignIn } from "@/src/hooks/useLogin";
import { useSignUp } from "@/src/hooks/useSignup";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

export default function Home() {
  const [isSignUp, setIsSignUp] = useState(false);

  const [loginMutation, loginData, loginErrors, handleLoginChange, handleLoginSubmit] = useSignIn();

 
  const [signupData, signupErrors, handleSignupChange, handleSignupSubmit, signupMutation] = useSignUp();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white selection:bg-blue-500/30">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 shadow-2xl backdrop-blur-md md:grid-cols-2">
        
        {/* Left Info Panel */}
        <div className="relative flex flex-col justify-between border-b border-slate-800/80 p-8 md:border-b-0 md:border-r md:border-slate-800/80 bg-slate-900/60">
          <div className="absolute right-0 top-0 p-6 opacity-5 pointer-events-none">
            <Sparkles className="size-40 text-blue-500" />
          </div>

          <div>
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400">
              AI Interview Platform
            </span>

            <h1 className="mt-4 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-3xl font-bold leading-tight tracking-tight text-transparent">
              Master Your Next Technical Assessment
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Real-time acoustic telemetry, secure code sandboxing, and automated AI evaluation reports designed for software engineers.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3 text-xs text-slate-500 font-mono">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>Connected to Render Cloud Backend</span>
          </div>
        </div>

        {/* Right Form Panel (Tabs) */}
        <div className="flex flex-col justify-center p-8 bg-slate-950/40">
          <div className="flex rounded-xl border border-slate-800/80 bg-slate-900/50 p-1 mb-6">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all duration-200 ${
                !isSignUp ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all duration-200 ${
                isSignUp ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          {!isSignUp ? (
            /* --- SIGN IN FORM --- */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginErrors.general && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-400">
                  {loginErrors.general}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={loginData.email}
                  onChange={handleLoginChange}
                  placeholder="engineer@example.com"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none transition duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={loginData.password}
                  onChange={handleLoginChange}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none transition duration-150"
                />
              </div>

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl border border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/10 transition duration-300 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 cursor-pointer"
              >
                {loginMutation.isPending ? "Authenticating..." : "Access Dashboard"}
                <ArrowRight className="size-4" />
              </button>
            </form>
          ) : (
            /* --- SIGN UP FORM --- */
            <form onSubmit={handleSignupSubmit} className="space-y-3">
              {signupErrors.general && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-400">
                  {signupErrors.general}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">First Name</label>
                  <input
                    type="text"
                    name="firstname"
                    required
                    value={signupData.firstname}
                    onChange={handleSignupChange}
                    placeholder="Dushant"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    name="lastname"
                    required
                    value={signupData.lastname}
                    onChange={handleSignupChange}
                    placeholder="Banpurkar"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  name="username"
                  required
                  value={signupData.username}
                  onChange={handleSignupChange}
                  placeholder="dushant_banpurkar"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={signupData.email}
                  onChange={handleSignupChange}
                  placeholder="engineer@example.com"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={signupData.password}
                  onChange={handleSignupChange}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={signupMutation.isPending}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl border border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/10 transition duration-300 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 cursor-pointer"
              >
                {signupMutation.isPending ? "Creating Account..." : "Get Started"}
                <ArrowRight className="size-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}