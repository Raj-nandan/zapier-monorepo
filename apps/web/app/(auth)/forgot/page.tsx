"use client";

import { useState } from "react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "@/lib/apiFetch";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") });
type Form = z.infer<typeof schema>;

export default function ForgotPage() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    setLoading(true);
    try {
      await apiFetch("/user/forgot", { method: "POST", body: JSON.stringify({ email: data.email }) });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <p>If an account exists for that email, a reset link is on its way.</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="text-sm text-ink-3">Enter your email and we will send you a reset link.</p>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input id="email" type="email" autoComplete="email" {...register("email")} className="mt-1 w-full rounded-md border border-line-strong px-3 py-2" />
        {errors.email && <p className="mt-1 text-sm text-status-failed">{errors.email.message}</p>}
      </div>
      <button type="submit" disabled={loading} className="w-full rounded-md bg-flame-500 px-4 py-2 text-white disabled:opacity-50">
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

