"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/safeNext";

const MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  provider_error: "Sign-in failed. Please try again.",
  state_mismatch: "Sign-in could not be verified. Please try again.",
};

function CallbackInner() {
  const params = useSearchParams();
  const error = params.get("error");

  if (!error) {
    if (typeof window !== "undefined") {
      const next = safeNext(params.get("next"));
      window.location.replace(next);
    }
    return <p>Signing in…</p>;
  }

  if (typeof window !== "undefined") {
    window.history.replaceState({}, "", "/auth/callback");
  }

  const message = MESSAGES[error] || "Something went wrong. Please try again.";
  return (
    <div>
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p role="alert" className="mt-2 text-sm text-status-failed">{message}</p>
      <a href="/login" className="mt-4 inline-block underline">Back to log in</a>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p>Signing in…</p>}>
      <CallbackInner />
    </Suspense>
  );
}

