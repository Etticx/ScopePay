import { snapshot } from "@/lib/store";
import { authorized, integrationStatus } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!await authorized()) return Response.json({ error: "Sign in to your workspace.", loginRequired: true }, { status: 401 });
  return Response.json({ workspace: await snapshot(), integrations: integrationStatus() }, { headers: { "Cache-Control": "no-store" } });
}
