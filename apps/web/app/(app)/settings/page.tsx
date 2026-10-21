"use client";

import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const [name, setName] = useState("");
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <Button size="sm">Save</Button>
          </CardContent>
        </Card>

        <Card id="connections">
          <CardHeader><CardTitle>Connections</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-ink-3">Connect Gmail or GitHub to use app actions.</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">Connect Gmail</Button>
              <Button variant="secondary" size="sm">Connect GitHub</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="secondary" size="sm">Export my data</Button>
            <Button variant="destructive" size="sm">Delete account</Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

