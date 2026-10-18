import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ownerGuard } from "@/lib/auth";
import { transaction } from "@/lib/store";
import { analyze } from "@/lib/analysis";
import { projectContext } from "@/lib/domain";
const input = z.object({ projectId: z.string(), message: z.string().trim().min(10).max(16000) });
export async function POST(request: Request) {
  try {
    await ownerGuard(request);
    const data = input.parse(await request.json());
    const context = await transaction(w => { const project = w.projects.find(p => p.id === data.projectId); if (!project) throw new Error("Project not found."); return projectContext(w, project); });
    const result = await analyze(context, data.message);
    const record = { id: randomUUID().slice(0, 12), projectId: data.projectId, message: data.message, ...result, createdAt: new Date().toISOString() };
    await transaction(w => { w.requests.unshift(record); w.activity.unshift({ id: randomUUID(), text: "Client request reviewed", at: record.createdAt, kind: "request" }); });
    return Response.json({ request: record });
  } catch (error) {
    const value = error as Error & { cause?: { code?: string } };
    const message = error instanceof z.ZodError ? "Enter a client request between 10 and 16,000 characters." : value.message === "fetch failed" ? `Could not connect to Groq${value.cause?.code ? ` (${value.cause.code})` : ""}. Check the server's network access and try again.` : value.message;
    return Response.json({ error: message }, { status: 400 });
  }
}
