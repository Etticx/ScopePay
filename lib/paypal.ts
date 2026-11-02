import type { Proposal } from "./types";
import { fetchExternal } from "./network";
import { paypalErrorMessage } from "./paypal-error";
const base = "https://api-m.sandbox.paypal.com";
async function accessToken() {
  const response = await fetchExternal(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", signal: AbortSignal.timeout(35000) });
  if (!response.ok) throw new Error("PayPal Sandbox authentication failed. Check your sandbox client ID and secret.");
  return (await response.json()).access_token as string;
}
async function paypal(path: string, method = "GET", body?: unknown, idempotency?: string) {
  const token = await accessToken();
  const response = await fetchExternal(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(idempotency ? { "PayPal-Request-Id": idempotency } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(35000) });
  if (!response.ok) throw Object.assign(new Error(paypalErrorMessage(response.status, await response.json().catch(() => null))), { status: response.status });
  if (response.status === 204) return {};
  return response.json();
}
export async function verifyPaid(proposal: Proposal) {
  return Boolean(proposal.orderId) && orderIsPaid(await getOrder(proposal.orderId!), proposal);
}

export function checkoutReturnUrls(origin: string, token: string) {
  const url = new URL(`/client/${encodeURIComponent(token)}`, origin);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Configure a secure APP_URL for checkout.");
  return { return_url: `${url.href}?checkout=return`, cancel_url: `${url.href}?checkout=cancel` };
}
export async function createOrder(proposal: Proposal, origin: string) {
  const order = await paypal("/v2/checkout/orders", "POST", {
    intent: "CAPTURE",
    purchase_units: [{ reference_id: proposal.id, custom_id: `${proposal.id}:v${proposal.version}`, description: proposal.title.slice(0, 127), amount: { currency_code: "USD", value: (proposal.totalCents / 100).toFixed(2) }, payee: { email_address: process.env.PAYPAL_SELLER_EMAIL } }],
    payment_source: { paypal: { experience_context: { brand_name: "ScopePay", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW", ...checkoutReturnUrls(origin, proposal.token) } } },
  }, `checkout-${proposal.id}-v${proposal.version}-a${proposal.paymentAttempt || 0}`);
  const url = order.links?.find((link: { rel: string }) => ["payer-action", "approve"].includes(link.rel))?.href;
  if (typeof order.id !== "string" || !url || new URL(url).protocol !== "https:" || new URL(url).hostname !== "www.sandbox.paypal.com") throw new Error("PayPal did not return a valid sandbox checkout. Retry preparing payment.");
  return { id: order.id as string, url: url as string };
}
export function getOrder(id: string) { return paypal(`/v2/checkout/orders/${encodeURIComponent(id)}`); }
// PayPal stops serving unpaid orders after a while, so a slow client needs a fresh one.
export async function orderGone(id: string) {
  try { return (await getOrder(id)).status === "VOIDED"; }
  catch (error) { if ((error as { status?: number }).status === 404) return true; throw error; }
}
export function orderMatches(order: Record<string, any>, proposal: Proposal, seller = process.env.PAYPAL_SELLER_EMAIL) {
  const units = order.purchase_units;
  if (!proposal.orderId || order.id !== proposal.orderId || order.intent !== "CAPTURE" || !Array.isArray(units) || units.length !== 1) return false;
  const unit = units[0];
  return unit.reference_id === proposal.id && unit.custom_id === `${proposal.id}:v${proposal.version}` && unit.amount?.currency_code === "USD" && Math.round(Number(unit.amount?.value) * 100) === proposal.totalCents && Boolean(seller) && unit.payee?.email_address?.toLowerCase() === seller?.toLowerCase();
}
export function orderIsPaid(order: Record<string, any>, proposal: Proposal, seller = process.env.PAYPAL_SELLER_EMAIL) {
  if (!orderMatches(order, proposal, seller) || order.status !== "COMPLETED") return false;
  const captures = order.purchase_units[0].payments?.captures;
  return Array.isArray(captures) && captures.length === 1 && typeof captures[0].id === "string" && captures[0].status === "COMPLETED" && captures[0].final_capture === true && captures[0].amount?.currency_code === "USD" && Math.round(Number(captures[0].amount?.value) * 100) === proposal.totalCents;
}
export async function captureOrder(proposal: Proposal) {
  if (!proposal.orderId) throw new Error("No checkout is attached to this proposal.");
  const order = await getOrder(proposal.orderId);
  if (!orderMatches(order, proposal)) throw new Error("PayPal checkout does not match the approved proposal.");
  if (order.status === "COMPLETED") return orderIsPaid(order, proposal);
  if (order.status !== "APPROVED") return false;
  // A stable request ID makes a retry safe if the first capture response is lost.
  await paypal(`/v2/checkout/orders/${encodeURIComponent(proposal.orderId)}/capture`, "POST", {}, `capture-${proposal.orderId}`);
  return orderIsPaid(await getOrder(proposal.orderId), proposal);
}
export async function verifyWebhook(request: Request, event: unknown) {
  if (!process.env.PAYPAL_WEBHOOK_ID) throw new Error("Configure PAYPAL_WEBHOOK_ID before accepting notifications.");
  const response = await paypal("/v1/notifications/verify-webhook-signature", "POST", { auth_algo: request.headers.get("paypal-auth-algo"), cert_url: request.headers.get("paypal-cert-url"), transmission_id: request.headers.get("paypal-transmission-id"), transmission_sig: request.headers.get("paypal-transmission-sig"), transmission_time: request.headers.get("paypal-transmission-time"), webhook_id: process.env.PAYPAL_WEBHOOK_ID, webhook_event: event });
  return response.verification_status === "SUCCESS";
}
