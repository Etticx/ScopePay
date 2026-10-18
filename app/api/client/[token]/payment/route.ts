import { z } from "zod";
import { sameOrigin } from "@/lib/auth";
import { transaction } from "@/lib/store";
import { confirmPayment } from "@/lib/checkout";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
    const { token } = await context.params;
    const input = z.object({ orderId: z.string().min(1).max(100).optional() }).parse(await request.json());
    const id = await transaction(w => w.proposals.find(p => p.token === token)?.id);
    if (!id) return Response.json({ error: "Proposal not found." }, { status: 404 });
    return Response.json({ paid: await confirmPayment(id, input.orderId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof z.ZodError ? "Invalid checkout details." : (error as Error).message }, { status: 400 });
  }
}
