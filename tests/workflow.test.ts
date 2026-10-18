import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "../lib/seed";
import { activatePaid, addDays, amountCents, projectContext } from "../lib/domain";
import { demoAnalysis, validateEvidence } from "../lib/analysis";
import { invoiceIsPaid } from "../lib/paypal";
import type { Proposal } from "../lib/types";

function fixture() {
  const w = seed();
  const p: Proposal = { id: "test-proposal", projectId: "p-bloom", requestId: "r-sample", title: "Cake booking", description: "Add a cake tasting booking form", hours: 4, rate: 50, totalCents: 20000, extraDays: 2, deadline: addDays(w.projects[0].deadline, 2), status: "approved", version: 1, token: "test", mode: "demo", createdAt: new Date().toISOString(), invoiceId: "INV2-TEST" };
  w.proposals.push(p);
  return { w, p };
}
test("prices use integer cents and reject invalid amounts", () => {
  assert.equal(amountCents(1.25, 49.99), 6249);
  assert.throws(() => amountCents(-1, 50));
  assert.throws(() => amountCents(NaN, 50));
});
test("paid change activates exactly once, even when a different event repeats it", () => {
  const { w, p } = fixture(); const tasks = w.projects[0].tasks.length;
  assert.equal(activatePaid(w, p, "event-one"), true);
  assert.equal(activatePaid(w, p, "event-two"), false);
  assert.equal(w.projects[0].tasks.length, tasks + 1);
  assert.equal(w.projects[0].deadline, p.deadline);
  assert.ok(projectContext(w, w.projects[0]).includes("Add a cake tasting booking form"));
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
test("PayPal verification rejects manual payments, wrong references, currencies and partial payments", () => {
  const { p } = fixture();
  const invoice = { id: p.invoiceId, detail: { reference: p.id }, status: "PAID", amount: { currency_code: "USD", value: "200.00" }, payments: { transactions: [{ type: "PAYPAL", amount: { currency_code: "USD", value: "200.00" } }] } };
  assert.equal(invoiceIsPaid(invoice, p), true);
  assert.equal(invoiceIsPaid({ ...invoice, detail: { reference: "other" } }, p), false);
  assert.equal(invoiceIsPaid({ ...invoice, amount: { currency_code: "EUR", value: "200.00" } }, p), false);
  assert.equal(invoiceIsPaid({ ...invoice, payments: { transactions: [{ type: "EXTERNAL", amount: { currency_code: "USD", value: "200.00" } }] } }, p), false);
  assert.equal(invoiceIsPaid({ ...invoice, status: "PARTIALLY_PAID" }, p), false);
});
