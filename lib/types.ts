export type Classification = "included" | "additional" | "clarify";
export type AnalysisItem = {
  title: string;
  classification: Classification;
  reason: string;
  evidence: string;
  question: string;
  hours: number;
};
export type Project = {
  id: string; name: string; client: string; email: string; initials: string;
  scope: string; rate: number; budget: number; deadline: string; createdAt: string;
  tasks: Task[];
};
export type Task = { id: string; name: string; start: string; days: number; progress: number; dependency?: string; proposalId?: string };
export type ScopeRequest = { id: string; projectId: string; message: string; items: AnalysisItem[]; engine: "demo" | "groq"; createdAt: string };
export type ProposalStatus = "draft" | "shared" | "approved" | "declined" | "revision_requested" | "paid";
export type Proposal = {
  id: string; projectId: string; requestId: string; title: string; description: string;
  hours: number; rate: number; totalCents: number; extraDays: number;
  deadline: string; status: ProposalStatus; version: number; token: string;
  mode: "demo" | "sandbox"; createdAt: string; approvedAt?: string; paidAt?: string;
  invoiceId?: string; orderId?: string; paymentUrl?: string; invoiceError?: string; clientNote?: string; scheduleReview?: boolean;
};
export type Activity = { id: string; text: string; at: string; kind: "project" | "request" | "proposal" | "payment" };
export type Workspace = { projects: Project[]; requests: ScopeRequest[]; proposals: Proposal[]; activity: Activity[]; events: string[] };
export type IntegrationStatus = { groq: boolean; paypal: boolean; webhook: boolean; protected: boolean };
export type PublicProposal = { proposal: Omit<Proposal, "token">; project: Pick<Project, "name" | "client" | "deadline"> };
