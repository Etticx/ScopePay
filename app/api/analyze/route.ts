import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ownerGuard } from "@/lib/auth";
import { snapshot, transaction } from "@/lib/store";
import { analyze } from "@/lib/analysis";
import { projectContext } from "@/lib/domain";
const input = z.object({ projectId: z.string(), message: z.string().trim().min(10).max(16000) });
export async function POST(request: Request) {
  try {
    await ownerGuard(request);
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Enter a client request between 10 and 16,000 characters." }, { status: 400 });
    const data = parsed.data;
    const w = await snapshot();
    const project = w.projects.find(p => p.id === data.projectId);
    if (!project) throw new Error("Project not found.");
    const result = await analyze(projectContext(w, project), data.message);
    const record = { id: randomUUID().slice(0, 12), projectId: data.projectId, message: data.message, ...result, createdAt: new Date().toISOString() };
    await transaction(w => { w.requests.unshift(record); w.activity.unshift({ id: randomUUID(), text: "Client request reviewed", at: record.createdAt, kind: "request" }); });
    return Response.json({ request: record });
  } catch (error) {
    const value = error as Error & { cause?: { code?: string } };
    // User input was checked above, so these errors mean the model's reply was unusable.
    const message = error instanceof z.ZodError || error instanceof SyntaxError ? "The AI returned an unusable reply. Please try again." : value.message === "fetch failed" ? `Could not connect to Groq${value.cause?.code ? ` (${value.cause.code})` : ""}. Check the server's network access and try again.` : value.message;
    return Response.json({ error: message }, { status: 400 });
  }
}
