"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


type Connection = { id: string; app: string; accountLabel: string };

async function fetchProfile() {
  const res = await apiFetch("/user/", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchConnections() {
  const res = await apiFetch("/connections", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.connections ?? [];
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const { data: connections = [] } = useQuery({ queryKey: ["connections"], queryFn: fetchConnections });
  const [name, setName] = useState("");
  const [initialized, setInitialized] = useState(false);
  if (profile && !initialized) {
    setName(profile.name ?? "");
    setInitialized(true);
  }

  async function saveProfile() {
    await apiFetch("/user/", { method: "PATCH", body: JSON.stringify({ name }) });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  async function connect(app: "gmail" | "github") {
    const res = await apiFetch(`/connections/${app}`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      window.location.href = data.authorizeUrl;
    }
  }

  async function disconnect(id: string) {
    const res = await apiFetch(`/connections/${id}`, { method: "DELETE" });
    if (res.status === 401) {
      alert("Re-authentication required.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["connections"] });
  }

  async function exportData() {
    const res = await apiFetch("/user/export", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (!confirm("Delete your account permanently?")) return;
    const res = await apiFetch("/user/", { method: "DELETE" });
    if (res.status === 401) {
      alert("Re-authentication required.");
      return;
    }
    if (res.ok) window.location.href = "/login";
  }

  async function logout() {
    await apiFetch("/user/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <AppShell active="/settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Settings</h1>
          <p className="text-sm text-ink-3">Profile, connections, and account.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-ink-3">{profile?.email}</div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <Button size="sm" onClick={saveProfile}>Save</Button>
          </CardContent>
        </Card>

        <Card id="connections">
          <CardHeader><CardTitle>Connections</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => connect("gmail")}>Connect Gmail</Button>
              <Button variant="secondary" size="sm" onClick={() => connect("github")}>Connect GitHub</Button>
            </div>
            <div className="space-y-2">
              {(connections as Connection[]).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm">
                  <span>{c.app} — {c.accountLabel}</span>
                  <Button variant="secondary" size="sm" onClick={() => disconnect(c.id)}>Disconnect</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={exportData}>Export my data</Button>
              <Button variant="secondary" size="sm" onClick={logout}>Sign out</Button>
              <Button variant="destructive" size="sm" onClick={deleteAccount}>Delete account</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
