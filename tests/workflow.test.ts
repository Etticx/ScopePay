import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "../lib/seed";
import { activatePaid, addDays, amountCents, lockedTasks, projectContext, scheduleReviewed } from "../lib/domain";
import { demoAnalysis, validateEvidence } from "../lib/analysis";
import type { Proposal } from "../lib/types";

function fixture() {
  const w = seed();
  const p: Proposal = { id: "test-proposal", projectId: "p-bloom", requestId: "r-sample", title: "Cake booking", description: "Add a cake tasting booking form", hours: 4, rate: 50, totalCents: 20000, extraDays: 2, deadline: addDays(w.projects[0].deadline, 2), status: "approved", version: 1, token: "test", mode: "demo", createdAt: new Date().toISOString() };
  w.proposals.push(p);
  return { w, p };
}
test("prices use integer cents and reject invalid amounts", () => {
  assert.equal(amountCents(1.25, 49.99), 6249);
  assert.throws(() => amountCents(-1, 50));
  assert.throws(() => amountCents(NaN, 50));
  assert.throws(() => amountCents(0.25, 0.01), /at least/);
});
test("paid change activates exactly once, even when a different event repeats it", () => {
  const { w, p } = fixture(); const tasks = w.projects[0].tasks.length;
  assert.equal(activatePaid(w, p, "event-one"), true);
  assert.equal(activatePaid(w, p, "event-two"), false);
  assert.equal(w.projects[0].tasks.length, tasks + 1);
  assert.equal(w.projects[0].deadline, p.deadline);
  assert.ok(projectContext(w, w.projects[0]).includes("Add a cake tasting booking form"));
});
test("work stays locked behind a payment milestone, and unlocks as the same task", () => {
  const { w, p } = fixture(); const project = w.projects[0]; const last = project.tasks.at(-1)!.id;
  const [payment, locked] = lockedTasks(project, p);
  assert.equal(payment.days, 0); assert.equal(payment.dependency, last);
  assert.equal(locked.locked, true); assert.equal(locked.dependency, payment.id); assert.equal(locked.days, p.extraDays);
  assert.equal(project.tasks.length, 4); // Previewing must not change the agreed plan.
  activatePaid(w, p, "event");
  const paid = project.tasks.at(-1)!;
  assert.equal(paid.id, locked.id); assert.equal(paid.start, locked.start); assert.equal(paid.locked, undefined); assert.equal(paid.dependency, last);
  assert.deepEqual(lockedTasks(project, p), []); // The deadline moved, so an old preview is never shown.
});
test("unapproved proposals cannot activate tasks", () => {
  const { w, p } = fixture(); p.status = "shared";
  assert.throws(() => activatePaid(w, p, "event"), /client-approved/);
  assert.equal(w.events.length, 0);
});
test("stale delivery dates hold scheduling for review", () => {
  const { w, p } = fixture(); const before = w.projects[0].tasks.length;
  activatePaid(w, p, "event", "2099-01-01");
  assert.equal(p.status, "paid"); assert.equal(p.scheduleReview, true);
  assert.equal(w.projects[0].tasks.length, before);
});
test("concurrent approved changes cannot silently replace an accepted delivery date", () => {
  const { w, p } = fixture(); w.projects[0].deadline = addDays(w.projects[0].deadline, 3);
  activatePaid(w, p, "event"); assert.equal(p.scheduleReview, true);
});
test("fabricated AI quotations become clarification requests", () => {
  const result = validateEvidence([{ title: "Booking", classification: "additional", reason: "Excluded", evidence: "Invented clause", question: "", hours: 4 }], "A five-page website.");
  assert.equal(result[0].classification, "clarify"); assert.equal(result[0].hours, 0);
});
test("demo examples distinguish included revisions, exclusions and uncertainty", () => {
  const scope = seed().projects[0].scope;
  assert.equal(demoAnalysis(scope, "Add appointment booking")[0].classification, "additional");
  assert.equal(demoAnalysis(scope, "First visual revision: change the heading colour")[0].classification, "included");
  assert.equal(demoAnalysis(scope, "Make it more premium")[0].classification, "clarify");
});
test("unverified quotations are never shown, on clarify items or as tiny fragments", () => {
  const scope = "A five-page website with a contact form.";
  const invented = validateEvidence([{ title: "Vague", classification: "clarify", reason: "Unclear", evidence: "Invented clause", question: "What changes?", hours: 0 }], scope);
  assert.equal(invented[0].evidence, "");
  const tiny = validateEvidence([{ title: "Booking", classification: "additional", reason: "Excluded", evidence: "a", question: "", hours: 5 }], scope);
  assert.equal(tiny[0].classification, "clarify"); assert.equal(tiny[0].hours, 0);
  const real = validateEvidence([{ title: "Form", classification: "included", reason: "Agreed", evidence: "website with a contact form", question: "", hours: 0 }], scope);
  assert.equal(real[0].classification, "included"); assert.equal(real[0].evidence, "website with a contact form");
});
test("a paid change with no extension finishes on the existing deadline", () => {
  const { w, p } = fixture(); p.extraDays = 0; p.deadline = w.projects[0].deadline;
  const deadline = w.projects[0].deadline;
  activatePaid(w, p, "event");
  const task = w.projects[0].tasks.at(-1)!;
  assert.equal(addDays(task.start, task.days), deadline); assert.equal(w.projects[0].deadline, deadline);
});
test("a paid change held for review can be placed after the current schedule, once", () => {
  const { w, p } = fixture(); const project = w.projects[0];
  activatePaid(w, p, "event", "2099-01-01");
  scheduleReviewed(w, p, "2099-01-01");
  const task = project.tasks.at(-1)!;
  assert.equal(task.proposalId, p.id); assert.equal(task.start, "2099-01-01");
  assert.equal(project.deadline, addDays("2099-01-01", p.extraDays)); assert.equal(p.deadline, project.deadline); assert.equal(p.scheduleReview, false);
  assert.throws(() => scheduleReviewed(w, p), /held for review/);
});
test("AI day estimates only count for additional work", () => {
  const scope = "Online ordering and appointment booking are explicitly excluded from this website.";
  const [extra, included] = validateEvidence([
    { title: "Booking", classification: "additional", reason: "Excluded", evidence: "appointment booking are explicitly excluded", question: "", hours: 6, days: 4 },
    { title: "Ordering", classification: "included", reason: "Agreed", evidence: "Online ordering and appointment booking", question: "", hours: 3, days: 2 },
  ], scope);
  assert.equal(extra.days, 4); assert.equal(included.days, 0); assert.equal(included.hours, 0);
  const invented = validateEvidence([{ title: "Booking", classification: "additional", reason: "Excluded", evidence: "Invented clause", question: "", hours: 6, days: 4 }], scope);
  assert.equal(invented[0].days, 0);
  assert.equal(demoAnalysis(seed().projects[0].scope, "Add appointment booking")[0].days, 3);
});
