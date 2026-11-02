import { cookies } from "next/headers";
import { createSession, equal, sameOrigin } from "@/lib/auth";
// One owner, so one counter: a per-visitor key could be dodged by forging x-forwarded-for.
// shortcut: a flood of wrong passwords also locks the owner out for ten minutes, use a shared limiter if this outlives the hackathon.
let attempts = { count: 0, expires: 0 };
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  if (attempts.expires <= Date.now()) attempts = { count: 0, expires: Date.now() + 600000 };
  if (++attempts.count > 10) return Response.json({ error: "Too many attempts. Try again in ten minutes." }, { status: 429 });
  const data = await request.json().catch(() => null);
  if (!process.env.APP_PASSWORD || !equal(String(data?.password || ""), process.env.APP_PASSWORD)) return Response.json({ error: "That workspace password does not match." }, { status: 401 });
  if (process.env.NODE_ENV === "production" && (process.env.SESSION_SECRET?.length || 0) < 32) return Response.json({ error: "Set SESSION_SECRET to at least 32 characters before hosting." }, { status: 503 });
  await createSession();
  attempts = { count: 0, expires: 0 };
  return Response.json({ ok: true });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  (await cookies()).delete("scopepay_session");
  return Response.json({ ok: true });
}
