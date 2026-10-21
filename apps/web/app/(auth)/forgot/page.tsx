"use client";

import { useState } from "react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "@/lib/apiFetch";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") });
type Form = z.infer<typeof schema>;

export default function ForgotPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/user/forgot", { method: "POST", body: JSON.stringify({ email: data.email }) });
      if (!res.ok) {
        if (res.status === 429) {
          setError("Too many requests. Please wait and try again later.");
          return;
        }
        setError("Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-ink">Check your email</h1>
        <div role="status" className="rounded-md border border-status-success/30 bg-status-success-bg p-3 text-sm text-status-success">
          If an account exists for that email, a password reset link is on its way.
        </div>
        <p className="text-sm text-ink-3">
          Didn&apos;t receive it? Check your spam folder or{" "}
          <button type="button" onClick={() => setDone(false)} className="text-flame-600 hover:underline">
            try another email
          </button>.
        </p>
        <div className="pt-2">
          <a href="/login" className="text-sm text-flame-600 hover:underline">Back to log in</a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <h1 className="text-2xl font-bold text-ink">Reset your password</h1>
      <p className="text-sm text-ink-3">Enter your account email and we will send you a reset link.</p>
      {error && <p role="alert" className="text-sm text-status-failed">{error}</p>}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">Email</label>
        <Input id="email" type="email" autoComplete="email" className="mt-1" {...register("email")} />
        {errors.email && <p className="mt-1 text-sm text-status-failed">{errors.email.message}</p>}
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-sm text-ink-3">Remember your password? <a href="/login" className="text-flame-600 hover:underline">Log in</a></p>
    </form>
  );
}

