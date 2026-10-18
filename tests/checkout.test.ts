import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { seed } from "../lib/seed";
import { checkoutReturnUrls, orderIsPaid, orderMatches } from "../lib/paypal";
import { addDays } from "../lib/domain";
import type { Proposal } from "../lib/types";

function proposal(): Proposal {
  return { id: "checkout-test", projectId: "p-bloom", requestId: "test-request", title: "Sandbox booking", description: "Fictional checkout test", hours: 1, rate: 1, totalCents: 100, extraDays: 1, deadline: addDays(seed().projects[0].deadline, 1), status: "approved", version: 1, token: "private-test-token", mode: "sandbox", createdAt: new Date().toISOString(), orderId: "ORDER-TEST" };
}
function order(p: Proposal, status = "COMPLETED") {
  return { id: p.orderId, intent: "CAPTURE", status, purchase_units: [{ reference_id: p.id, custom_id: `${p.id}:v1`, payee: { email_address: "seller@business.example.com" }, amount: { currency_code: "USD", value: "1.00" }, payments: { captures: [{ id: "CAPTURE-TEST", status: "COMPLETED", final_capture: true, amount: { currency_code: "USD", value: "1.00" } }] } }] };
}
test("checkout verification rejects approval alone, foreign orders, wrong sellers, versions and incomplete captures", () => {
  const p = proposal(); const paid = order(p); const seller = "seller@business.example.com";
  assert.equal(orderIsPaid(paid, p, seller), true);
  assert.equal(orderIsPaid({ ...paid, status: "APPROVED" }, p, seller), false);
  assert.equal(orderIsPaid({ ...paid, id: "OTHER" }, p, seller), false);
  assert.equal(orderIsPaid(paid, p, "other@example.com"), false);
  assert.equal(orderMatches(paid, { ...p, version: 2 }, seller), false);
  for (const change of [{ status: "PENDING" }, { status: "REFUNDED" }, { final_capture: false }, { amount: { currency_code: "EUR", value: "1.00" } }, { amount: { currency_code: "USD", value: "0.50" } }]) {
    const altered = structuredClone(paid);
    Object.assign(altered.purchase_units[0].payments.captures[0], change);
    assert.equal(orderIsPaid(altered, p, seller), false);
  }
});
test("return URLs stay on the proposal and refuse insecure public origins", () => {
  assert.deepEqual(checkoutReturnUrls("http://127.0.0.1:3000", "abc"), { return_url: "http://127.0.0.1:3000/client/abc?checkout=return", cancel_url: "http://127.0.0.1:3000/client/abc?checkout=cancel" });
  assert.throws(() => checkoutReturnUrls("http://example.com", "abc"), /secure/);
});
test("checkout lifecycle reuses the order, rejects forged callbacks, captures once and schedules once", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "scopepay-checkout-"));
  const oldData = process.env.DATA_DIR; const oldSeller = process.env.PAYPAL_SELLER_EMAIL; const originalFetch = globalThis.fetch;
  process.env.DATA_DIR = directory; process.env.PAYPAL_SELLER_EMAIL = "seller@business.example.com";
  // The store resolves DATA_DIR at import time. Import only AFTER isolating it.
  const { transaction } = await import("../lib/store");
  const { ensurePayment, confirmPayment } = await import("../lib/checkout");
  let created = 0; let captured = 0; let status = "CREATED";
  let loseCaptureResponse = false;
  const p = proposal(); delete p.orderId;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/oauth2/token")) return Response.json({ access_token: "test-token" });
    if (url.endsWith("/v2/checkout/orders") && init?.method === "POST") {
      created++;
      const body = JSON.parse(String(init.body));
      assert.equal(body.payment_source.paypal.experience_context.return_url, `http://127.0.0.1:3000/client/${p.token}?checkout=return`);
      assert.equal(body.purchase_units[0].amount.value, "1.00");
      return Response.json({ id: "ORDER-TEST", links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-TEST" }] });
    }
    if (url.endsWith("/ORDER-TEST/capture")) { captured++; status = "COMPLETED"; assert.equal((init?.headers as Record<string, string>)["PayPal-Request-Id"], "capture-checkout-test-v1"); if (loseCaptureResponse) throw new Error("Capture response lost"); return Response.json({ status }); }
    if (url.endsWith("/ORDER-TEST")) return Response.json(order({ ...p, orderId: "ORDER-TEST" }, status));
    throw new Error(`Unexpected test request: ${url}`);
  };
  try {
    await transaction(w => { Object.assign(w, seed()); w.proposals.push(p); });
    await ensurePayment(p.id, "http://127.0.0.1:3000"); await ensurePayment(p.id, "http://127.0.0.1:3000");
    assert.equal(created, 1);
    assert.equal(await confirmPayment(p.id), false);
    await assert.rejects(confirmPayment(p.id, "WRONG-ORDER"), /does not belong/);
    assert.equal(captured, 0);
    status = "APPROVED";
    assert.equal(await confirmPayment(p.id), false); // A status refresh never captures an approved order.
    const results = await Promise.all([confirmPayment(p.id, "ORDER-TEST"), confirmPayment(p.id, "ORDER-TEST")]);
    assert.deepEqual(results, [true, true]); assert.equal(captured, 1);
    const state = await transaction(w => w);
    assert.equal(state.proposals.find(item => item.id === p.id)?.status, "paid");
    assert.equal(state.projects[0].tasks.filter(task => task.proposalId === p.id).length, 1);
    assert.equal(state.projects[0].deadline, p.deadline);
    // An ambiguous capture response must recover by reading PayPal, never charging again.
    await transaction(w => { Object.assign(w, seed()); w.proposals.push({ ...p, orderId: "ORDER-TEST" }); });
    status = "APPROVED"; loseCaptureResponse = true;
    await assert.rejects(confirmPayment(p.id, "ORDER-TEST"), /response lost/);
    const beforeRetry = captured;
    assert.equal(await confirmPayment(p.id, "ORDER-TEST"), true);
    assert.equal(captured, beforeRetry);
    assert.equal(await transaction(w => w.projects[0].tasks.filter(task => task.proposalId === p.id).length), 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldData === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = oldData;
    if (oldSeller === undefined) delete process.env.PAYPAL_SELLER_EMAIL; else process.env.PAYPAL_SELLER_EMAIL = oldSeller;
    await rm(directory, { recursive: true, force: true });
  }
});
