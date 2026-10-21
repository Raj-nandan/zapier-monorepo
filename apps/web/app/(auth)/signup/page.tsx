"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "@/lib/apiFetch";
import { safeNext } from "@/lib/safeNext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(1, "Name is required.").optional(),
  username: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});
type Form = z.infer<typeof schema>;

function calculateStrength(pwd: string): { label: string; score: number; color: string } {
  if (!pwd || pwd.length < 8) return { label: "Weak", score: 1, color: "bg-status-failed" };
  const hasLetters = /[a-zA-Z]/.test(pwd);
  const hasNumbers = /[0-9]/.test(pwd);
  const hasSymbols = /[^a-zA-Z0-9]/.test(pwd);
  const variety = Number(hasLetters) + Number(hasNumbers) + Number(hasSymbols);
  if (pwd.length >= 12 && variety >= 2) return { label: "Strong", score: 3, color: "bg-status-success" };
  if (variety >= 2 || pwd.length >= 10) return { label: "Okay", score: 2, color: "bg-status-waiting" };
  return { label: "Weak", score: 1, color: "bg-status-failed" };
}

function SignupPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const passwordValue = watch("password") || "";
  const strength = calculateStrength(passwordValue);

  async function onSubmit(data: Form) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/user/signup", { method: "POST", body: JSON.stringify(data) });
      if (!res.ok) {
        setError(res.status === 429 ? "Too many requests. Please wait and try again." : "Something went wrong. Please try again.");
        return;
      }
      // Invalidate the session cookies set by signup so user explicitly logs in
      await apiFetch("/user/logout", { method: "POST" }).catch(() => {});
      router.push("/login?registered=true");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <h1 className="text-2xl font-bold text-ink">Create your account</h1>
      <p className="text-sm text-ink-3">Publish a workflow in minutes.</p>
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
        <label htmlFor="name" className="block text-sm font-medium text-ink">Name</label>
        <Input id="name" autoComplete="name" className="mt-1" {...register("name")} />
        {errors.name && <p className="mt-1 text-sm text-status-failed">{errors.name.message}</p>}
      </div>
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-ink">Email</label>
        <Input id="username" type="email" autoComplete="username" className="mt-1" {...register("username")} />
        {errors.username && <p className="mt-1 text-sm text-status-failed">{errors.username.message}</p>}
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">Password</label>
        <div className="relative mt-1"><Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" {...register("password")} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div>
        {passwordValue.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-line">
              <div className={`h-full flex-1 rounded-full ${strength.score >= 1 ? strength.color : "bg-transparent"}`} />
              <div className={`h-full flex-1 rounded-full ${strength.score >= 2 ? strength.color : "bg-transparent"}`} />
              <div className={`h-full flex-1 rounded-full ${strength.score >= 3 ? strength.color : "bg-transparent"}`} />
            </div>
            <p className="text-xs text-ink-3">Strength: <span className="font-medium">{strength.label}</span> (advisory)</p>
          </div>
        )}
        <p className="mt-1 text-xs text-ink-3">At least 8 characters.</p>
        {errors.password && <p className="mt-1 text-sm text-status-failed">{errors.password.message}</p>}
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating…" : "Create account"}
      </Button>
      <p className="text-sm text-ink-3">Already have an account? <a href="/login" className="text-flame-600 hover:underline">Log in</a></p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<p className="text-ink-3">Loading…</p>}>
      <SignupPageInner />
    </Suspense>
  );
}
