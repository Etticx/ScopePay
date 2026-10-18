import test from "node:test";
import assert from "node:assert/strict";
import { fetchExternal } from "../lib/network";
test("connection establishment timeout is retried, with the same request", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    if (calls === 1) throw Object.assign(new Error("fetch failed"), { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
    return new Response("ok");
  };
  const result = await fetchExternal("https://example.com", { method: "POST", body: "unchanged" }, request as typeof fetch);
  assert.equal(result.status, 200); assert.equal(calls, 2);
});
test("HTTP errors and ambiguous socket resets are not retried", async () => {
  let calls = 0;
  const response = await fetchExternal("https://example.com", {}, (async () => { calls++; return new Response("limited", { status: 429 }); }) as typeof fetch);
  assert.equal(response.status, 429); assert.equal(calls, 1);
  await assert.rejects(() => fetchExternal("https://example.com", {}, (async () => { calls++; throw Object.assign(new Error("reset"), { cause: { code: "ECONNRESET" } }); }) as typeof fetch));
  assert.equal(calls, 2);
});
