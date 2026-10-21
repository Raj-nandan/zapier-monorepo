"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export default function ZapDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [active, setActive] = useState(true);

  return (
    <AppShell active="/zap/create">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Automation</h1>
            <p className="text-sm text-ink-3">Editing automation {id}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary">Test</Button>
            <Button>Publish</Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-3">Trigger and actions load from the backend.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">Active</span>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Webhook URL</label>
                <Input readOnly value="https://hooks.zapflow.app/catch/…" className="font-mono text-xs" />
              </div>
              <Button variant="secondary" size="sm" className="w-full">Rotate secret</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

