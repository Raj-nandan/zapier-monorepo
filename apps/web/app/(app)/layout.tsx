import { redirect } from "next/navigation";
import { serverFetch } from "@/lib/serverFetch";

async function getUser() {
  try {
    const res = await serverFetch("/user/", { method: "GET" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.email !== "string") return null;
    return data as { email: string; name: string | null };
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  return <>{children}</>;
}
