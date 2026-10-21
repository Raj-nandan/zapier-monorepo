"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "@/lib/apiFetch";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});
type Form = z.infer<typeof schema>;

function ResetPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenFromUrl = params.get("token");
  const [token] = useState<string | null>(tokenFromUrl);
  const [invalid, setInvalid] = useState(!tokenFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    if (!token) {
      setInvalid(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/user/reset", {
        method: "POST",
        body: JSON.stringify({ token, password: data.password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (res.status === 400 && body?.error?.includes("invalid or expired")) {
          setInvalid(true);
        } else {
          setError(body?.error || "Failed to reset password. Please try again.");
        }
        return;
      }
      router.push("/login?reset=true");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (invalid) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-ink">Reset your password</h1>
        <p role="alert" className="text-sm text-status-failed">This reset link is invalid or expired. Request a new one.</p>
        <a
          href="/forgot"
          className="inline-block rounded-md bg-flame-500 px-4 py-2 text-sm font-medium text-white hover:bg-flame-600"
        >
          Request a new link
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <h1 className="text-2xl font-bold text-ink">Choose a new password</h1>
      <p className="text-sm text-ink-3">Enter your new password below (at least 8 characters).</p>
      {error && <p role="alert" className="text-sm text-status-failed">{error}</p>}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">New Password</label>
        <div className="relative mt-1">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-3">At least 8 characters.</p>
        {errors.password && <p className="mt-1 text-sm text-status-failed">{errors.password.message}</p>}
      </div>
      <Button type="submit" disabled={loading || !token} className="w-full">
        {loading ? "Updating…" : "Update password"}
      </Button>
      <p className="text-sm text-ink-3">Remember your password? <a href="/login" className="text-flame-600 hover:underline">Log in</a></p>
    </form>
  );
}


export default function ResetPagePage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <ResetPageInner />
    </Suspense>
  );
}

