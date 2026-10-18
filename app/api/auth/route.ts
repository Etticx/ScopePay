import { cookies } from "next/headers";
import { createSession, equal, sameOrigin } from "@/lib/auth";
const attempts = new Map<string, { count: number; expires: number }>();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const key = request.headers.get("x-forwarded-for") || "local";
  const previous = attempts.get(key);
  const value = previous && previous.expires > Date.now() ? previous : { count: 0, expires: Date.now() + 600000 };
  if (++value.count > 10) return Response.json({ error: "Too many attempts. Try again in ten minutes." }, { status: 429 });
  attempts.set(key, value);
  const data = await request.json();
  if (!process.env.APP_PASSWORD || !equal(String(data.password || ""), process.env.APP_PASSWORD)) return Response.json({ error: "That workspace password does not match." }, { status: 401 });
  if (process.env.NODE_ENV === "production" && (process.env.SESSION_SECRET?.length || 0) < 32) return Response.json({ error: "Set SESSION_SECRET to at least 32 characters before hosting." }, { status: 503 });
  await createSession();
  attempts.delete(key);
  return Response.json({ ok: true });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  (await cookies()).delete("scopepay_session");
  return Response.json({ ok: true });
}
