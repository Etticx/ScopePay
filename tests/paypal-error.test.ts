import test from "node:test";
import assert from "node:assert/strict";
import { paypalErrorMessage } from "../lib/paypal-error";
test("PayPal errors retain useful provider codes while excluding personal and credential data", () => {
  const result = paypalErrorMessage(403, { name: "NOT_AUTHORIZED", message: "sensitive recipient@example.com", details: [{ issue: "PERMISSION_DENIED", value: "secret" }, { issue: "private@example.com" }] });
  assert.match(result, /403: NOT_AUTHORIZED, PERMISSION_DENIED/);
  assert.ok(!result.includes("@")); assert.ok(!result.includes("secret"));
  assert.match(paypalErrorMessage(502, null), /502/);
});
