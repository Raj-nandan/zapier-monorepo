"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "@/lib/apiFetch";

const schema = z.object({ password: z.string().min(8, "Password must be at least 8 characters.").max(128) });
type Form = z.infer<typeof schema>;

function ResetPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const t = params.get("token");
    if (!t) { setInvalid(true); return; }
    setToken(t);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
    }
  }, [params]);

  async function onSubmit(data: Form) {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/user/reset", { method: "POST", body: JSON.stringify({ token, password: data.password }) });
      if (!res.ok) {
        setInvalid(true);
        return;
      }
      router.push("/login");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (invalid) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="mt-2 text-sm text-status-failed">This reset link is invalid or expired. Request a new one.</p>
        <a href="/forgot" className="mt-4 inline-block underline">Request a new one</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {error && <p role="alert" className="text-sm text-status-failed">{error}</p>}
      <div>
        <label htmlFor="password" className="block text-sm font-medium">Password</label>
        <input id="password" type="password" autoComplete="new-password" {...register("password")} className="mt-1 w-full rounded-md border border-line-strong px-3 py-2" />
        {errors.password && <p className="mt-1 text-sm text-status-failed">{errors.password.message}</p>}
      </div>
      <button type="submit" disabled={loading || !token} className="w-full rounded-md bg-flame-500 px-4 py-2 text-white disabled:opacity-50">
        {loading ? "Updating…" : "Update password"}
      </button>
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

