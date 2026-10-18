import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export function integrationStatus() {
  return { groq: Boolean(process.env.GROQ_API_KEY), paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_SELLER_EMAIL), webhook: Boolean(process.env.PAYPAL_WEBHOOK_ID), protected: Boolean(process.env.APP_PASSWORD && process.env.SESSION_SECRET) };
}
const localSecret = randomBytes(32).toString("hex");
function signature(value: string) { return createHmac("sha256", process.env.SESSION_SECRET || localSecret).update(value).digest("hex"); }
export function equal(a: string, b: string) { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export async function authorized() {
  if (!process.env.APP_PASSWORD) return process.env.NODE_ENV === "development";
  if (process.env.NODE_ENV === "production" && (process.env.SESSION_SECRET?.length || 0) < 32) return false;
  const cookie = (await cookies()).get("scopepay_session")?.value || "";
  const [expires, hash] = cookie.split(".");
  return Number(expires) > Date.now() && equal(hash || "", signature(expires || ""));
}
export async function createSession() {
  const expires = String(Date.now() + 24 * 60 * 60 * 1000);
  (await cookies()).set("scopepay_session", `${expires}.${signature(expires)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 86400 });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL || new URL(request.url).origin;
  return !origin || origin === expected || (process.env.NODE_ENV === "development" && ["http://127.0.0.1:3000", "http://localhost:3000"].includes(origin));
}
export async function ownerGuard(request: Request) {
  if (!sameOrigin(request)) throw new Error("Cross-origin request rejected.");
  if (!await authorized()) throw new Error("Sign in to your workspace.");
}
