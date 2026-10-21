import { cookies } from "next/headers";

export async function serverFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieStore = cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  const backend = process.env.BACKEND_URL || "http://localhost:3001";
  return fetch(`${backend}/api/v1${path}`, { ...init, headers, cache: "no-store" });
}
