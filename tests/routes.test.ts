import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { seed } from "../lib/seed";
import { addDays } from "../lib/domain";
import { sameOrigin, sessionValue, validSession } from "../lib/auth";
import type { Proposal } from "../lib/types";

delete process.env.DATA_DIR; // Never let a real data directory reach these tests.
test.after(() => rm(process.env.DATA_DIR!, { recursive: true, force: true }));
const url = "http://127.0.0.1:3000/api/test";
const post = (body: unknown, headers: Record<string, string> = {}) => new Request(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });
const params = (token: string) => ({ params: Promise.resolve({ token }) });

async function setup() {
  // The store resolves DATA_DIR at import time. Import only AFTER isolating it.
  process.env.DATA_DIR ||= await mkdtemp(path.join(tmpdir(), "scopepay-routes-"));
  const { snapshot, transaction } = await import("../lib/store");
  const proposal: Proposal = { id: "route-test", projectId: "p-bloom", requestId: "r-sample", title: "Booking", description: "Fictional route test", hours: 1, rate: 1, totalCents: 100, extraDays: 1, deadline: addDays(seed().projects[0].deadline, 1), status: "shared", version: 2, token: "route-token", mode: "demo", createdAt: new Date().toISOString() };
  await transaction(w => { Object.assign(w, seed()); w.proposals.push(proposal); });
  return { snapshot, transaction };
}

test("sessions reject forged signatures, expired cookies and junk", () => {
  const future = String(Date.now() + 60000);
  assert.equal(validSession(sessionValue(future)), true);
  assert.equal(validSession(`${future}.${"0".repeat(64)}`), false);
  assert.equal(validSession(sessionValue(String(Date.now() - 1))), false);
  assert.equal(validSession(""), false);
});
test("a foreign origin is rejected, while browser-less requests stay allowed", () => {
  assert.equal(sameOrigin(post({}, { origin: "https://evil.example.com" })), false);
  assert.equal(sameOrigin(post({}, { origin: "http://127.0.0.1:3000" })), true);
  assert.equal(sameOrigin(post({})), true);
});
test("owner routes refuse anyone who is not signed in, and change nothing", async () => {
  const { snapshot } = await setup();
  const { POST } = await import("../app/api/action/route");
  const before = await snapshot();
  const response = await POST(post({ action: "shareProposal", id: "route-test" }));
  assert.equal(response.status, 400); assert.match((await response.json()).error, /Sign in/);
  assert.deepEqual(await snapshot(), before);
  const { POST: analyze } = await import("../app/api/analyze/route");
  assert.match((await (await analyze(post({ projectId: "p-bloom", message: "Please add a booking page" }))).json()).error, /Sign in/);
});
test("a client can only answer the current version, and only once", async () => {
  const { snapshot } = await setup();
  const { POST } = await import("../app/api/client/[token]/route");
  assert.equal((await POST(post({ decision: "approve", version: 1 }), params("route-token"))).status, 400);
  assert.equal((await POST(post({ decision: "approve", version: 2 }), params("wrong-token"))).status, 400);
  assert.equal((await snapshot()).proposals.find(p => p.id === "route-test")?.status, "shared");
  assert.equal((await POST(post({ decision: "approve", version: 2 }), params("route-token"))).status, 200);
  assert.equal((await snapshot()).proposals.find(p => p.id === "route-test")?.status, "approved");
  assert.equal((await POST(post({ decision: "decline", version: 2 }), params("route-token"))).status, 400);
});
test("a client cannot approve a delivery date the schedule has moved past", async () => {
  const { snapshot, transaction } = await setup();
  await transaction(w => { w.proposals.find(p => p.id === "route-test")!.deadline = "2000-01-01"; });
  const { POST } = await import("../app/api/client/[token]/route");
  const response = await POST(post({ decision: "approve", version: 2 }), params("route-token"));
  assert.equal(response.status, 400); assert.match((await response.json()).error, /out of date/);
  assert.equal((await snapshot()).proposals.find(p => p.id === "route-test")?.status, "shared");
  assert.equal((await POST(post({ decision: "revise", version: 2, note: "Please update the date" }), params("route-token"))).status, 200);
});
test("the client page hides the private token", async () => {
  await setup();
  const { GET } = await import("../app/api/client/[token]/route");
  const body = await (await GET(post({}), params("route-token"))).json();
  assert.equal(body.proposal.id, "route-test"); assert.equal(body.proposal.token, undefined);
  assert.ok(body.project.tasks.length > 0); assert.equal(body.project.email, undefined);
});
test("a webhook with a bad signature changes nothing", async () => {
  const { snapshot, transaction } = await setup();
  await transaction(w => { const p = w.proposals.find(p => p.id === "route-test")!; p.status = "approved"; p.mode = "sandbox"; p.orderId = "ORDER-HOOK"; });
  const originalFetch = globalThis.fetch;
  process.env.PAYPAL_WEBHOOK_ID = "test-webhook";
  globalThis.fetch = async input => Response.json(String(input).endsWith("/oauth2/token") ? { access_token: "test" } : { verification_status: "FAILURE" });
  try {
    const { POST } = await import("../app/api/paypal/webhook/route");
    const response = await POST(post({ id: "EVENT", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAPTURE", supplementary_data: { related_ids: { order_id: "ORDER-HOOK" } } } }));
    assert.equal(response.status, 403);
    assert.equal((await snapshot()).proposals.find(p => p.id === "route-test")?.status, "approved");
  } finally { globalThis.fetch = originalFetch; delete process.env.PAYPAL_WEBHOOK_ID; }
});
test("a verified capture webhook marks the matching proposal paid", async () => {
  const { snapshot, transaction } = await setup();
  await transaction(w => { const p = w.proposals.find(p => p.id === "route-test")!; p.status = "approved"; p.mode = "sandbox"; p.orderId = "ORDER-HOOK"; });
  const originalFetch = globalThis.fetch;
  process.env.PAYPAL_WEBHOOK_ID = "test-webhook"; process.env.PAYPAL_SELLER_EMAIL = "seller@business.example.com";
  const order = { id: "ORDER-HOOK", intent: "CAPTURE", status: "COMPLETED", purchase_units: [{ reference_id: "route-test", custom_id: "route-test:v2", payee: { email_address: "seller@business.example.com" }, amount: { currency_code: "USD", value: "1.00" }, payments: { captures: [{ id: "CAPTURE", status: "COMPLETED", final_capture: true, amount: { currency_code: "USD", value: "1.00" } }] } }] };
  globalThis.fetch = async input => { const u = String(input); return Response.json(u.endsWith("/oauth2/token") ? { access_token: "test" } : u.endsWith("/verify-webhook-signature") ? { verification_status: "SUCCESS" } : order); };
  try {
    const { POST } = await import("../app/api/paypal/webhook/route");
    const response = await POST(post({ id: "EVENT-OK", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAPTURE", supplementary_data: { related_ids: { order_id: "ORDER-HOOK" } } } }));
    assert.equal(response.status, 200);
    assert.equal((await snapshot()).proposals.find(p => p.id === "route-test")?.status, "paid");
  } finally { globalThis.fetch = originalFetch; delete process.env.PAYPAL_WEBHOOK_ID; delete process.env.PAYPAL_SELLER_EMAIL; }
});
test("login attempts are limited even when x-forwarded-for keeps changing, and bad JSON is a normal rejection", async () => {
  process.env.APP_PASSWORD = "correct-password";
  const { POST } = await import("../app/api/auth/route");
  assert.equal((await POST(post("not json"))).status, 401);
  for (let i = 0; i < 9; i++) assert.equal((await POST(post({ password: "wrong" }, { "x-forwarded-for": `10.0.0.${i}` }))).status, 401);
  assert.equal((await POST(post({ password: "correct-password" }, { "x-forwarded-for": "10.0.1.1" }))).status, 429);
  delete process.env.APP_PASSWORD;
});
test("reading a proposal does not rewrite the data file", async () => {
  await setup();
  const file = path.join(process.env.DATA_DIR!, "workspace.json");
  const before = (await stat(file)).mtimeMs;
  const { GET } = await import("../app/api/client/[token]/route");
  assert.equal((await GET(post({}), params("route-token"))).status, 200);
  assert.equal((await stat(file)).mtimeMs, before);
});
