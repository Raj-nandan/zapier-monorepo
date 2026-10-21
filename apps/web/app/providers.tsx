"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ensureCsrf } from "@/lib/auth";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => {
    ensureCsrf();
  }, []);
  return <QueryClientProvider client={client}>{children}<Toaster position="bottom-right" richColors /></QueryClientProvider>;
}
