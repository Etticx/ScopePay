import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { ownerGuard, integrationStatus } from "@/lib/auth";
import { transaction } from "@/lib/store";
import { amountCents, addDays, activatePaid } from "@/lib/domain";
import { ensurePayment, confirmPayment } from "@/lib/checkout";
import type { Proposal } from "@/lib/types";

export async function POST(request: Request) {
  try {
    await ownerGuard(request);
    const data = await request.json();
    let result: unknown;
    if (data.action === "createProject") {
      const input = z.object({ name: z.string().trim().min(3).max(100), client: z.string().trim().min(2).max(100), email: z.email(), scope: z.string().trim().min(40).max(24000), rate: z.number().positive().max(10000), budget: z.number().positive().max(1000000), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(data);
      if (input.deadline < new Date().toISOString().slice(0, 10)) throw new Error("Choose a future delivery date.");
      result = await transaction(w => {
        const project = { ...input, id: randomUUID().slice(0, 12), initials: input.name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase(), createdAt: new Date().toISOString(), tasks: [{ id: randomUUID().slice(0, 12), name: "Agreed project delivery", start: new Date().toISOString().slice(0, 10), days: Math.max(1, Math.round((Date.parse(input.deadline) - Date.now()) / 86400000)), progress: 0 }] };
        w.projects.unshift(project);
        w.activity.unshift({ id: randomUUID(), text: `Project scope saved · ${project.name}`, at: project.createdAt, kind: "project" });
        return project;
      });
    } else if (data.action === "saveProposal") {
      const input = z.object({ requestId: z.string(), title: z.string().trim().min(3).max(160), description: z.string().trim().min(10).max(2000), hours: z.number().positive().max(200), rate: z.number().positive().max(10000), extraDays: z.number().int().min(0).max(180) }).parse(data);
      result = await transaction(w => {
        const r = w.requests.find(r => r.id === input.requestId);
        const project = w.projects.find(p => p.id === r?.projectId);
        if (!r || !project) throw new Error("Request not found.");
        const existing = w.proposals.find(p => p.requestId === r.id && p.status !== "declined");
        if (existing && !["draft", "revision_requested"].includes(existing.status)) throw new Error("This request already has a shared or approved proposal. Its accepted terms are locked.");
        const proposal: Proposal = { ...input, id: existing?.id || randomUUID().slice(0, 12), projectId: project.id, totalCents: amountCents(input.hours, input.rate), deadline: addDays(project.deadline, input.extraDays), status: "draft", version: existing ? existing.version + 1 : 1, token: randomBytes(24).toString("hex"), mode: integrationStatus().paypal ? "sandbox" : "demo", createdAt: new Date().toISOString() };
        if (existing) w.proposals.splice(w.proposals.indexOf(existing), 1, proposal); else w.proposals.unshift(proposal);
        return proposal;
      });
    } else if (data.action === "shareProposal") {
      result = await transaction(w => {
        const p = w.proposals.find(p => p.id === data.id);
        if (!p || p.status !== "draft") throw new Error("Save a draft before sharing.");
        p.status = "shared";
        w.activity.unshift({ id: randomUUID(), text: `Proposal ready for client · ${p.title}`, at: new Date().toISOString(), kind: "proposal" });
        return p;
      });
    } else if (data.action === "issueInvoice") {
      await ensurePayment(z.string().parse(data.id), process.env.APP_URL || new URL(request.url).origin);
    } else if (data.action === "simulatePayment" || data.action === "checkPayment") {
      const p = await transaction(w => w.proposals.find(p => p.id === data.id));
      if (!p || !["approved", "paid"].includes(p.status)) throw new Error("The client must approve this proposal before payment.");
      if (data.action === "simulatePayment") {
        if (p.mode !== "demo") throw new Error("Payment simulation is only available for proposals originally created in demo mode.");
      } else {
        if (!await confirmPayment(p.id)) throw new Error("PayPal has not confirmed a matching full payment yet.");
        return Response.json({ ok: true });
      }
      await transaction(w => { const current = w.proposals.find(item => item.id === p.id)!; activatePaid(w, current, `${p.mode}-${p.id}`); });
    } else throw new Error("Unknown action.");
    return Response.json({ ok: true, result });
  } catch (error) { return Response.json({ error: error instanceof z.ZodError ? "Please check the form. Names, scope, email, dates and amounts must be valid." : (error as Error).message }, { status: 400 }); }
}
