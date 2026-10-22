export type StepKind = "trigger" | "action";

export interface BuilderStep {
  id: string;
  kind: StepKind;
  slug: string;
  backendId: string;
  title: string;
  sub: string;
  iconPath: string;
  iconBg: string;
  iconFg: string;
  status: "ok" | "idle";
  metadata: Record<string, any>;
}
