import type { Project, Proposal, Task, Workspace } from "./types";

export function amountCents(hours: number, rate: number) {
  if (!Number.isFinite(hours) || !Number.isFinite(rate) || hours <= 0 || rate <= 0) throw new Error("Enter positive hours and an hourly rate.");
  const cents = Math.round(hours * Math.round(rate * 100));
  if (cents < 1) throw new Error("The total must be at least $0.01.");
  return cents;
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
type PlannedChange = Pick<Proposal, "id" | "title" | "extraDays" | "deadline">;
export function scheduleStale(project: Pick<Project, "deadline">, proposal: PlannedChange, today = new Date().toISOString().slice(0, 10)) {
  return today > project.deadline || addDays(project.deadline, proposal.extraDays) !== proposal.deadline;
}
function changeTask(project: Pick<Project, "deadline" | "tasks">, proposal: PlannedChange): Task {
  // With no extension, the one-day task must finish on the deadline, not after it.
  const start = proposal.extraDays ? project.deadline : addDays(project.deadline, -1);
  return { id: `change-${proposal.id}`, name: proposal.title, start, days: Math.max(1, proposal.extraDays), progress: 0, dependency: project.tasks.at(-1)?.id, proposalId: proposal.id };
}
// What the timeline will gain once paid: a payment milestone gating the locked work.
export function lockedTasks(project: Pick<Project, "deadline" | "tasks">, proposal: PlannedChange): Task[] {
  if (scheduleStale(project, proposal)) return [];
  const task = changeTask(project, proposal);
  const payment = `payment-${proposal.id}`;
  return [{ id: payment, name: "Payment", start: task.start, days: 0, progress: 0, dependency: task.dependency }, { ...task, dependency: payment, locked: true }];
}
export function activatePaid(workspace: Workspace, proposal: Proposal, eventId: string, today = new Date().toISOString().slice(0, 10)) {
  if (workspace.events.includes(eventId) || proposal.status === "paid") return false;
  if (proposal.status !== "approved") throw new Error("Payment must match a client-approved proposal.");
  const project = workspace.projects.find(p => p.id === proposal.projectId);
  if (!project) throw new Error("Project not found.");
  proposal.status = "paid";
  proposal.paidAt = new Date().toISOString();
  proposal.scheduleReview = scheduleStale(project, proposal, today);
  if (!proposal.scheduleReview) {
    project.tasks.push(changeTask(project, proposal));
    project.deadline = addDays(project.deadline, proposal.extraDays);
  }
  workspace.events.push(eventId);
  workspace.activity.unshift({ id: eventId, text: `${proposal.mode === "demo" ? "Demo payment simulated" : "PayPal sandbox payment verified"} · ${proposal.title}${proposal.scheduleReview ? " · Schedule needs review" : ""}`, at: new Date().toISOString(), kind: "payment" });
  return true;
}
// The owner places a paid change held for review after the current schedule (or today, if that has passed).
export function scheduleReviewed(workspace: Workspace, proposal: Proposal, today = new Date().toISOString().slice(0, 10)) {
  if (proposal.status !== "paid" || !proposal.scheduleReview) throw new Error("Only a paid change held for review can be scheduled.");
  const project = workspace.projects.find(p => p.id === proposal.projectId);
  if (!project) throw new Error("Project not found.");
  const base = project.deadline > today ? project.deadline : today;
  proposal.deadline = addDays(base, proposal.extraDays);
  project.tasks.push(changeTask({ deadline: base, tasks: project.tasks }, proposal));
  project.deadline = proposal.deadline;
  proposal.scheduleReview = false;
  workspace.activity.unshift({ id: `schedule-${proposal.id}`, text: `Paid change scheduled · ${proposal.title}`, at: new Date().toISOString(), kind: "payment" });
}
