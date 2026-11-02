import { z } from "zod";
import { snapshot, transaction } from "@/lib/store";
import { sameOrigin } from "@/lib/auth";
import { ensurePayment } from "@/lib/checkout";
type Context = { params: Promise<{ token: string }> };
export async function GET(_request: Request, context: Context) {
  const { token } = await context.params;
  const w = await snapshot();
  const p = w.proposals.find(p => p.token === token && p.status !== "draft");
  const project = w.projects.find(project => project.id === p?.projectId);
  if (!p || !project) return Response.json({ error: "This proposal link is unavailable or has been replaced by a newer version." }, { status: 404 });
  const { token: _secret, ...proposal } = p;
  return Response.json({ proposal, project: { name: project.name, client: project.client, deadline: project.deadline, tasks: project.tasks } }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
export async function POST(request: Request, context: Context) {
  try {
    if (!sameOrigin(request)) throw new Error("Invalid origin.");
    const { token } = await context.params;
    const input = z.object({ decision: z.enum(["approve", "decline", "revise"]), version: z.number().int(), note: z.string().max(1000).default("") }).parse(await request.json());
    const id = await transaction(w => {
      const p = w.proposals.find(p => p.token === token);
      if (!p || p.status !== "shared" || p.version !== input.version) throw new Error("This proposal has already been answered or revised. Refresh to see its current status.");
      p.status = input.decision === "approve" ? "approved" : input.decision === "decline" ? "declined" : "revision_requested";
      p.clientNote = input.note;
      if (input.decision === "approve") p.approvedAt = new Date().toISOString();
      w.activity.unshift({ id: crypto.randomUUID(), text: `Client ${input.decision === "approve" ? "approved" : input.decision === "decline" ? "declined" : "requested a revision to"} · ${p.title}`, at: new Date().toISOString(), kind: "proposal" });
      return { id: p.id, mode: p.mode };
    });
    let notice = "";
    if (input.decision === "approve" && id.mode === "sandbox") {
      try { await ensurePayment(id.id, process.env.APP_URL || new URL(request.url).origin); } catch { notice = "Approved. Payment link pending."; }
    }
    return Response.json({ ok: true, notice });
  } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
}
