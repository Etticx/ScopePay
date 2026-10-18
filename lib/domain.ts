import type { Project, Proposal, Workspace } from "./types";

export function amountCents(hours: number, rate: number) {
  if (!Number.isFinite(hours) || !Number.isFinite(rate) || hours <= 0 || rate <= 0) throw new Error("Enter positive hours and an hourly rate.");
  return Math.round(hours * Math.round(rate * 100));
}
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}
export function dateLabel(date: string) {
  return new Date(date.length === 10 ? `${date}T12:00:00Z` : date).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
export function projectContext(workspace: Workspace, project: Project) {
  return [project.scope, ...workspace.proposals.filter(p => p.projectId === project.id && p.status === "paid").map(p => `Approved and paid addition: ${p.title}. ${p.description}`)].join("\n\n");
}
export function activatePaid(workspace: Workspace, proposal: Proposal, eventId: string, today = new Date().toISOString().slice(0, 10)) {
  if (workspace.events.includes(eventId) || proposal.status === "paid") return false;
  if (proposal.status !== "approved") throw new Error("Payment must match a client-approved proposal.");
  const project = workspace.projects.find(p => p.id === proposal.projectId);
  if (!project) throw new Error("Project not found.");
  proposal.status = "paid";
  proposal.paidAt = new Date().toISOString();
  proposal.scheduleReview = today > project.deadline || addDays(project.deadline, proposal.extraDays) !== proposal.deadline;
  if (!proposal.scheduleReview) {
    const start = project.deadline;
    project.tasks.push({ id: `change-${proposal.id}`, name: proposal.title, start, days: Math.max(1, proposal.extraDays), progress: 0, dependency: project.tasks.at(-1)?.id, proposalId: proposal.id });
    project.deadline = addDays(project.deadline, proposal.extraDays);
  }
  workspace.events.push(eventId);
  workspace.activity.unshift({ id: eventId, text: `${proposal.mode === "demo" ? "Demo payment simulated" : "PayPal sandbox payment verified"} · ${proposal.title}${proposal.scheduleReview ? " · Schedule needs review" : ""}`, at: new Date().toISOString(), kind: "payment" });
  return true;
}
