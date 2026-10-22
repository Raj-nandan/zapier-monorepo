"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "@/lib/apiFetch";
import { safeNext } from "@/lib/safeNext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  username: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});
type Form = z.infer<typeof schema>;

function LoginPageInner() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const registered = params.get("registered") === "true";
  const resetSuccess = params.get("reset") === "true";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/user/signin", { method: "POST", body: JSON.stringify(data) });
      if (!res.ok) {
        setError(res.status === 429 ? "Too many requests. Please wait and try again." : "Invalid credentials. Please try again.");
        return;
      }
       window.location.replace(next);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
      <p className="text-sm text-ink-3">Log in to manage your automations.</p>
      {registered && (
        <div role="status" className="rounded-md border border-status-success/30 bg-status-success-bg p-3 text-sm text-status-success">
          Account created successfully! Please log in to continue.
        </div>
      )}
      {resetSuccess && (
        <div role="status" className="rounded-md border border-status-success/30 bg-status-success-bg p-3 text-sm text-status-success">
          Password updated successfully! Please log in with your new password.
        </div>
      )}
      {error && <p role="alert" className="text-sm text-status-failed">{error}</p>}
      <div className="flex gap-2">
        <a href={`/api/v1/auth/google?next=${encodeURIComponent(next)}`} className="flex-1 rounded-sm border border-line-strong bg-surface px-3 py-2 text-center text-sm font-medium text-ink hover:bg-sunken">Google</a>
        <a href={`/api/v1/auth/github?next=${encodeURIComponent(next)}`} className="flex-1 rounded-sm border border-line-strong bg-surface px-3 py-2 text-center text-sm font-medium text-ink hover:bg-sunken">GitHub</a>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-3">or with email</span>
        <div className="h-px flex-1 bg-line" />
      </div>
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-ink">Email</label>
        <Input id="username" type="email" autoComplete="username" className="mt-1" {...register("username")} />
        {errors.username && <p className="mt-1 text-sm text-status-failed">{errors.username.message}</p>}
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">Password</label>
        <div className="relative mt-1"><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" {...register("password")} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div>
        {errors.password && <p className="mt-1 text-sm text-status-failed">{errors.password.message}</p>}
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Signing in…" : "Log in"}
      </Button>
      <div className="text-sm">
        <a href="/forgot" className="text-flame-600 hover:underline">Forgot password?</a>
      </div>
      <p className="text-sm text-ink-3">New here? <a href="/signup" className="text-flame-600 hover:underline">Create an account</a></p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-ink-3">Loading…</p>}>
      <LoginPageInner />
    </Suspense>
  );
}
